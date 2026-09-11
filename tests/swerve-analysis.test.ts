import { test } from "node:test"
import assert from "node:assert/strict"
import { analyzeSwerve, moduleStates, INCH } from "../lib/swerve-analysis"
import { fixture } from "./config-fixture"
const fresh = () => structuredClone(fixture)
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)
test("default 4 inch NEO drivetrain has analytically correct translation and spin limits", () => {
  const a = analyzeSwerve(fresh())
  assert.deepEqual(a.findings, [])
  const speed = (5676 / 60 / 6.75) * Math.PI * 4 * INCH
  near(a.maxSpeed!, speed)
  near(a.maxOmega!, speed / Math.hypot(10 * INCH, 10 * INCH))
})
test("translation, strafe, stop and counterclockwise spin use WPILib axes", () => {
  const a = analyzeSwerve(fresh())
  for (const s of moduleStates(a.modules, 2, 0, 0).states) {
    near(s.speed, 2)
    near(s.angle, 0)
  }
  for (const s of moduleStates(a.modules, 0, 1, 0).states)
    near(s.angle, Math.PI / 2)
  for (const s of moduleStates(a.modules, 0, 0, 0).states) near(s.speed, 0)
  const spin = moduleStates(a.modules, 0, 0, 1)
  near(spin.states[0].angle, (3 * Math.PI) / 4)
  near(spin.states[1].angle, Math.PI / 4)
})
test("mixed commands desaturate uniformly against per-module gearing", () => {
  const c = fresh()
  c.modules.frontleft.gearing = {
    drive: { gearRatio: 13.5, diameter: 4 },
    angle: { gearRatio: 12.8 },
  }
  const a = analyzeSwerve(c),
    result = moduleStates(a.modules, 4, 3, 8)
  assert.ok(result.scale < 1)
  for (const [i, s] of result.states.entries()) {
    assert.ok(s.speed <= a.modules[i].speed! + 1e-8)
    near(s.speed / s.requestedSpeed, result.scale)
  }
  near(a.maxSpeed!, a.modules[0].speed!)
})
test("invalid, nonfinite and coincident geometry suppress limits", () => {
  for (const value of [0, -1, NaN, Infinity]) {
    const c = fresh()
    c.physicalproperties.gearing.drive.gearRatio = value
    assert.equal(analyzeSwerve(c).maxSpeed, null)
  }
  const c = fresh()
  c.modules.frontleft.location = { ...c.modules.frontright.location }
  assert.equal(analyzeSwerve(c).valid, false)
  c.modules.frontleft.location.front = Infinity
  assert.equal(analyzeSwerve(c).maxOmega, null)
})
test("collinear support, module list and invalid addresses are errors", () => {
  const c = fresh()
  Object.values(c.modules).forEach((m) => (m.location.left = 0))
  assert.equal(analyzeSwerve(c).valid, false)
  const d = fresh()
  d.modules.frontleft.drive.id = 63
  d.swervedrive.modules[0] = "missing.json"
  assert.ok(
    analyzeSwerve(d).findings.filter((f) => f.severity === "error").length >= 2,
  )
})
test("CAN aliases produce review warnings while separate buses and attached encoders do not", () => {
  const c = fresh()
  c.modules.frontright.drive.id = 1
  assert.ok(
    analyzeSwerve(c).findings.some((f) => f.message.includes("shares CAN")),
  )
  c.modules.frontright.drive.canbus = "canivore"
  assert.equal(analyzeSwerve(c).findings.length, 0)
  c.modules.frontleft.absoluteEncoder.type = "revthroughbore_attached"
  c.modules.frontleft.absoluteEncoder.id = 1
  assert.equal(analyzeSwerve(c).findings.length, 0)
})
test("unknown motors do not silently inherit NEO limits", () => {
  const c = fresh()
  c.modules.frontleft.drive.type = "talonfx_krakenx60"
  assert.equal(analyzeSwerve(c).maxSpeed, null)
  assert.ok(analyzeSwerve(c, { frontleft: 6000 }).maxSpeed)
  assert.equal(analyzeSwerve(c, { frontleft: NaN }).maxSpeed, null)
})
test("oversize wheels, excessive current and suspicious offsets are reviewable; negative gains block", () => {
  const c = fresh()
  c.physicalproperties.gearing.drive.diameter = 40
  c.physicalproperties.statorCurrentLimit = { drive: 150 }
  c.modules.frontleft.absoluteEncoderOffset = 720
  assert.ok(
    analyzeSwerve(c).findings.filter((f) => f.severity === "warning").length >=
      3,
  )
  c.pidfproperties.angle.p = -1
  assert.equal(analyzeSwerve(c).valid, false)
})

test("forward kinematics recovers desaturated motion from asymmetric layout", async () => {
  const { chassisVelocity, advancePose, origin } =
    await import("../lib/swerve-simulation")
  const c = fresh()
  c.modules.frontleft.location.front = 17
  const a = analyzeSwerve(c),
    motion = moduleStates(a.modules, 4, 2, 5)
  const v = chassisVelocity(a.modules, motion.states)
  near(v.vx, 4 * motion.scale)
  near(v.vy, 2 * motion.scale)
  near(v.omega, 5 * motion.scale)
  const straight = advancePose(origin(), { vx: 2, vy: 1, omega: 0 }, 2)
  near(straight.x, 4)
  near(straight.y, 2)
  const circle = advancePose(origin(), { vx: 1, vy: 0, omega: 1 }, Math.PI * 2)
  near(circle.x, 0)
  near(circle.y, 0)
  const rotated = advancePose(
    { x: 0, y: 0, heading: Math.PI / 2 },
    { vx: 1, vy: 0, omega: 0 },
    1,
  )
  near(rotated.x, 0)
  near(rotated.y, 1)
})

test("student reduction experiment honors overrides without changing export source", async () => {
  const { previewReduction } = await import("../lib/swerve-simulation")
  const c = fresh()
  c.modules.frontleft.gearing = {
    drive: { gearRatio: 9, diameter: 4 },
    angle: { gearRatio: 12.8 },
  }
  const before = JSON.stringify(c)
  const preview = previewReduction(c, 2)
  near(preview.modules.frontleft.gearing!.drive.gearRatio, 18)
  near(preview.modules.frontright.gearing!.drive.gearRatio, 13.5)
  near(analyzeSwerve(preview).maxSpeed!, analyzeSwerve(c).maxSpeed! / 2)
  assert.equal(JSON.stringify(c), before)
})

test("steering optimization preserves wheel vector through reversal and wrap", async () => {
  const { optimizeWheel } = await import("../lib/swerve-simulation")
  for (const [angle, current] of [
    [Math.PI, 0],
    [(-179 * Math.PI) / 180, (179 * Math.PI) / 180],
    [0, 10 * Math.PI],
  ]) {
    const optimized = optimizeWheel(angle, 2, current)
    assert.ok(Math.abs(optimized.delta) <= Math.PI / 2)
    near(Math.cos(optimized.angle) * optimized.speed, Math.cos(angle) * 2)
    near(Math.sin(optimized.angle) * optimized.speed, Math.sin(angle) * 2)
  }
  near(optimizeWheel(Math.PI, 2, 0).speed, -2)
})
