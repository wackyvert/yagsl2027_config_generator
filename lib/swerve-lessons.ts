/**
 * Guided lessons for the drivebase lab.
 *
 * Each lesson sets the robot-relative command [forward m/s, left m/s,
 * rotation rad/s], asks one prediction before the student presses play, then
 * explains what the model actually does. Everything here is the ideal 12 V
 * no-load kinematic model in lib/swerve-analysis.ts: no torque, mass,
 * traction, voltage sag or steering delay. It predicts geometry, not what
 * your robot will do on a field, and it is not a safety check.
 */
export type SwerveLesson = {
  id: string
  title: string
  prediction: string
  explanation: string
  command: [number, number, number]
}

export const SWERVE_LESSONS: SwerveLesson[] = [
  {
    id: "translation-axes",
    title: "1 · Forward and strafe are the same motion, rotated",
    prediction:
      "This command is 0 m/s forward, 1 m/s left, 0 rad/s. Before you press play: what steering angle will each of the four modules show, and will the four angles match? Then try the Forward preset [1, 0, 0] and predict again.",
    explanation:
      "Every module receives the vector (vx − ω·y, vy + ω·x). With ω = 0 the position terms vanish, so all four get the identical vector (0, 1): all steer to 90° at the same commanded wheel speed. Forward [1, 0, 0] is that picture rotated to 0°. Pure translation is independent of where modules sit on the frame, so strafing is not a special case. Module location only matters once ω is nonzero. The 1 m/s is a commanded wheel speed, not a free speed — if a module's limit is below 1 m/s, desaturation scales it down.",
    command: [0, 1, 0],
  },
  {
    id: "pure-rotation",
    title: "2 · Pure rotation points every wheel a different way",
    prediction:
      "Now 0 forward, 0 left, 2 rad/s counterclockwise. Will the four steering angles match this time? Which module's wheel turns fastest — and what happens to that speed if you move one module farther from the center in its tab?",
    explanation:
      "With vx = vy = 0 each vector becomes (−ω·y, ω·x): perpendicular to the line from the rotation center to that module, pointing counterclockwise for positive ω. Each module steers tangent to its own circle, 90° ahead of its radius — the pinwheel. Wheel speed is ω × distance from the center, so a module 0.42 m out runs 0.84 m/s at 2 rad/s. The rotation ceiling uses the smallest speed-to-radius ratio across modules; the outermost corner saturates first only when all modules share a wheel-speed limit. The rotation center is the configured origin, not necessarily your center of mass.",
    command: [0, 0, 2],
  },
  {
    id: "desaturation",
    title: "3 · Desaturation scales everything, not just the fast wheel",
    prediction:
      "5 m/s forward, 3 m/s left and 8 rad/s at once. Read your own scale readout: is this command achievable on your configuration? If it is scaled, which changes — the travel direction, the spin-to-translation ratio, the steering angles, or none of them?",
    explanation:
      "Requested module vectors are computed first, then one factor k = min(1, the smallest limit ÷ request ratio across modules) multiplies every module. Each module is compared against its own limit, which matters when modules use different gearing. Because the kinematics are linear, scaling all wheel vectors by k scales vx, vy and ω identically: steering angles are untouched and the path shape holds, just slower. Clamping modules separately would shrink fast wheels more than slow ones and steer you somewhere you did not ask for. This command commonly saturates the default configuration — compare the Requested and Displayed columns.",
    command: [5, 3, 8],
  },
  {
    id: "gear-reduction",
    title: "4 · Gear reduction trades top speed against wheel torque",
    prediction:
      "Hold this 1 m/s forward command and move the preview reduction slider between 0.5× and 2×. Predict two things: which way does the 'Pure translation' ceiling move, and does the robot in the 3D view actually travel any faster at this command?",
    explanation:
      "Free speed = motor RPM ÷ 60 ÷ reduction × π × wheel diameter, so 2× reduction halves the translation ceiling and 0.5× doubles it. At 1 m/s the motion can look unchanged, because nothing is saturated and this model knows only speed limits. The tradeoff it omits: for the same motor torque, doubling the reduction doubles the ideal torque delivered at the wheel while halving wheel speed. Whether that actually helps depends on traction (the μg ceiling above), current limits and thermals, none of which are modeled. The slider is preview-only and is never exported.",
    command: [1, 0, 0],
  },
]
