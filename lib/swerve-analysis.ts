import type { ConfigData } from "./types"

export const MODULE_KEYS = [
  "frontleft",
  "frontright",
  "backleft",
  "backright",
] as const
export type ModuleKey = (typeof MODULE_KEYS)[number]
export type Finding = {
  severity: "error" | "warning"
  message: string
  tab: string
}
export const INCH = 0.0254
const positive = (n: number) => Number.isFinite(n) && n > 0
// Verified REV NEO V1 free speed at 12 V. Other motors require an explicit assumption.
export const motorRPM = (type: string) =>
  type?.endsWith("_neo") ? 5676 : undefined

export function analyzeSwerve(
  config: ConfigData,
  rpmOverrides: Partial<Record<ModuleKey, number>> = {},
) {
  const findings: Finding[] = []
  const add = (severity: Finding["severity"], message: string, tab: string) =>
    findings.push({ severity, message, tab })
  const addresses = new Map<string, string>()
  const address = (
    namespace: string,
    id: number,
    name: string,
    tab: string,
    max: number,
  ) => {
    if (!Number.isInteger(id) || id < 0 || id > max)
      add("error", `${name}: address must be an integer from 0 to ${max}.`, tab)
    else {
      const key = `${namespace}:${id}`
      if (addresses.has(key))
        add(
          "warning",
          `${name} shares ${namespace} address ${id} with ${addresses.get(key)}. ${namespace.startsWith("CAN") ? "Verify device addressing; CAN device families can have separate ID spaces." : "Use a distinct input channel for each sensor."}`,
          tab,
        )
      addresses.set(key, name)
    }
  }
  if (config.swervedrive.gyro.type?.endsWith("_can"))
    address(
      `CAN ${config.swervedrive.gyro.canbus || "default"}`,
      config.swervedrive.gyro.id,
      "Gyro",
      "gyro",
      62,
    )
  const modules = MODULE_KEYS.map((key) => {
    const m = config.modules[key]
    const gear = m.gearing ?? config.physicalproperties.gearing
    const x = m.location.front * INCH,
      y = m.location.left * INCH
    if (!Number.isFinite(m.location.front) || !Number.isFinite(m.location.left))
      add("error", `${key}: locations must be finite numbers in inches.`, key)
    else if (Math.max(Math.abs(x), Math.abs(y)) > 1.5)
      add(
        "warning",
        `${key}: module is over 1.5 m from an origin axis. Check inches versus millimeters.`,
        key,
      )
    if (
      (key.startsWith("front") ? x <= 0 : x >= 0) ||
      (key.endsWith("left") ? y <= 0 : y >= 0)
    )
      add(
        "warning",
        `${key}: location does not match its named quadrant (+X forward, +Y left).`,
        key,
      )
    for (const [label, value, low, high] of [
      ["drive ratio", gear?.drive?.gearRatio, 2, 20],
      ["wheel diameter (in)", gear?.drive?.diameter, 2, 8],
      ["steering ratio", gear?.angle?.gearRatio, 5, 40],
    ] as const) {
      if (!positive(value))
        add(
          "error",
          `${key}: ${label} must be finite and greater than zero.`,
          m.gearing ? key : "properties",
        )
      else if (value < low || value > high)
        add(
          "warning",
          `${key}: ${label} is outside the typical ${low}–${high} range. Verify units and reduction direction.`,
          m.gearing ? key : "properties",
        )
    }
    for (const role of ["drive", "angle"] as const)
      address(
        `CAN ${m[role].canbus || "default"}`,
        m[role].id,
        `${key} ${role}`,
        key,
        62,
      )
    const enc = m.absoluteEncoder
    if (enc.type?.endsWith("_can"))
      address(
        `CAN ${enc.canbus || "default"}`,
        enc.id,
        `${key} encoder`,
        key,
        62,
      )
    if (enc.type?.endsWith("_dio"))
      address("DIO", enc.channel, `${key} encoder`, key, 25)
    if (enc.type?.endsWith("_analog"))
      address("Analog", enc.channel, `${key} encoder`, key, 7)
    if (!Number.isFinite(m.absoluteEncoderOffset))
      add("error", `${key}: encoder offset must be finite.`, key)
    else if (Math.abs(m.absoluteEncoderOffset) > 360)
      add(
        "warning",
        `${key}: encoder offset exceeds one revolution; verify degrees.`,
        key,
      )
    const rpm = rpmOverrides[key] ?? motorRPM(m.drive.type)
    if (!positive(rpm ?? NaN))
      add(
        "warning",
        `${key}: enter a verified motor free speed to calculate limits for ${m.drive.type}.`,
        "visualizer",
      )
    const speed =
      positive(rpm ?? NaN) &&
      positive(gear?.drive?.gearRatio) &&
      positive(gear?.drive?.diameter)
        ? (rpm! / 60 / gear.drive.gearRatio) *
          Math.PI *
          gear.drive.diameter *
          INCH
        : null
    if (speed !== null && speed > 8)
      add(
        "warning",
        `${key}: ideal free speed exceeds 8 m/s. Check gearing, wheel diameter and motor RPM.`,
        "properties",
      )
    return { key, x, y, diameter: gear?.drive?.diameter * INCH, speed, rpm }
  })
  for (let i = 0; i < modules.length; i++)
    for (let j = i + 1; j < modules.length; j++) {
      const a = modules[i],
        b = modules[j],
        distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (distance < 0.001)
        add("error", `${a.key} and ${b.key} occupy the same position.`, b.key)
      else if (distance < (a.diameter + b.diameter) / 2)
        add(
          "warning",
          `${a.key} and ${b.key}: wheel swept envelopes overlap. Check mechanical clearance.`,
          b.key,
        )
    }
  const finiteGeometry = modules.every(
    (m) => Number.isFinite(m.x) && Number.isFinite(m.y),
  )
  const area = finiteGeometry
    ? Math.max(
        ...modules.flatMap((a) =>
          modules.flatMap((b) =>
            modules.map((c) =>
              Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)),
            ),
          ),
        ),
      )
    : 0
  if (area < 1e-6)
    add(
      "error",
      "Module positions do not form a support area. Use distinct, non-collinear locations.",
      "frontleft",
    )
  for (const role of ["drive", "angle"] as const) {
    const current = config.physicalproperties.statorCurrentLimit?.[role]
    if (current !== undefined && !positive(current))
      add(
        "error",
        `${role} current limit must be finite and positive.`,
        "properties",
      )
    else if (current !== undefined && current > (role === "drive" ? 100 : 60))
      add(
        "warning",
        `${role} current limit is unusually high. Verify motor and controller ratings.`,
        "properties",
      )
    for (const [gain, value] of Object.entries(config.pidfproperties[role]))
      if (value !== undefined && (!Number.isFinite(value) || value < 0))
        add(
          "error",
          `${role} ${gain}: gain must be finite and nonnegative.`,
          "properties",
        )
  }
  const expected = MODULE_KEYS.map((key) => `${key}.json`)
  if (
    config.swervedrive.modules.length !== 4 ||
    expected.some((name) => !config.swervedrive.modules.includes(name))
  )
    add(
      "error",
      "Module file list must reference each of the four generated module files exactly once.",
      "gyro",
    )
  const valid = !findings.some((f) => f.severity === "error")
  const complete = valid && modules.every((m) => m.speed !== null)
  return {
    findings,
    modules,
    valid,
    maxSpeed: complete ? Math.min(...modules.map((m) => m.speed!)) : null,
    maxOmega: complete
      ? Math.min(
          ...modules.map((m) =>
            Math.hypot(m.x, m.y) > 0
              ? m.speed! / Math.hypot(m.x, m.y)
              : Infinity,
          ),
        )
      : null,
  }
}

export function moduleStates(
  modules: ReturnType<typeof analyzeSwerve>["modules"],
  vx: number,
  vy: number,
  omega: number,
) {
  const requested = modules.map((m) => {
    const x = vx - omega * m.y,
      y = vy + omega * m.x
    return { key: m.key, speed: Math.hypot(x, y), angle: Math.atan2(y, x) }
  })
  const known = modules.every((m) => m.speed !== null)
  const scale = known
    ? Math.min(
        1,
        ...requested.map((s, i) =>
          s.speed > 0 ? modules[i].speed! / s.speed : 1,
        ),
      )
    : 1
  return {
    scale,
    known,
    states: requested.map((s) => ({
      ...s,
      requestedSpeed: s.speed,
      speed: s.speed * scale,
    })),
  }
}
