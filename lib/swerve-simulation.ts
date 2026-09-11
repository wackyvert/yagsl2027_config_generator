import type { analyzeSwerve, moduleStates } from "./swerve-analysis"
export type Pose = { x: number; y: number; heading: number }
export const origin = (): Pose => ({ x: 0, y: 0, heading: 0 })
// Least-squares forward kinematics about the configured origin, including asymmetric layouts.
export function chassisVelocity(
  modules: ReturnType<typeof analyzeSwerve>["modules"],
  states: ReturnType<typeof moduleStates>["states"],
) {
  const n = modules.length
  const mx = modules.reduce((s, m) => s + m.x, 0) / n,
    my = modules.reduce((s, m) => s + m.y, 0) / n
  const vectors = states.map((s) => ({
    x: s.speed * Math.cos(s.angle),
    y: s.speed * Math.sin(s.angle),
  }))
  const ux = vectors.reduce((s, v) => s + v.x, 0) / n,
    uy = vectors.reduce((s, v) => s + v.y, 0) / n
  const denominator = modules.reduce(
    (s, m) => s + (m.x - mx) ** 2 + (m.y - my) ** 2,
    0,
  )
  const omega =
    denominator > 1e-12
      ? modules.reduce(
          (s, m, i) =>
            s -
            (m.y - my) * (vectors[i].x - ux) +
            (m.x - mx) * (vectors[i].y - uy),
          0,
        ) / denominator
      : 0
  return { vx: ux + omega * my, vy: uy - omega * mx, omega }
}
// Exact constant-twist integration, so turning motion is independent of frame rate.
export function advancePose(
  pose: Pose,
  velocity: ReturnType<typeof chassisVelocity>,
  dt: number,
): Pose {
  const { vx, vy, omega } = velocity
  if (![vx, vy, omega, dt].every(Number.isFinite) || dt <= 0) return pose
  const angle = omega * dt
  const a = Math.abs(angle) < 1e-8 ? dt : Math.sin(angle) / omega
  const b = Math.abs(angle) < 1e-8 ? 0 : (1 - Math.cos(angle)) / omega
  const dx = a * vx - b * vy,
    dy = b * vx + a * vy
  return {
    x: pose.x + Math.cos(pose.heading) * dx - Math.sin(pose.heading) * dy,
    y: pose.y + Math.sin(pose.heading) * dx + Math.cos(pose.heading) * dy,
    heading: Math.atan2(
      Math.sin(pose.heading + angle),
      Math.cos(pose.heading + angle),
    ),
  }
}
