"use client"

import { useMemo, useState, useRef } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  analyzeSwerve,
  moduleStates,
  MODULE_KEYS,
  motorRPM,
} from "@/lib/swerve-analysis"
import type { ConfigData } from "@/lib/types"
const Scene = dynamic(() => import("./swerve-scene"), {
  ssr: false,
  loading: () => <p>Loading 3D drivebase…</p>,
})
const fmt = (n: number | null, unit: string) =>
  n !== null && Number.isFinite(n) ? `${n.toFixed(2)} ${unit}` : "Unavailable"

export function SwerveVisualizer({
  config,
  onEdit,
}: {
  config: ConfigData
  onEdit: (tab: string) => void
}) {
  const [rpm, setRPM] = useState<
    Partial<Record<(typeof MODULE_KEYS)[number], number>>
  >({})
  const [command, setCommand] = useState([1, 0, 0])
  const [view, setView] = useState<"perspective" | "top">("perspective")
  const [playing, setPlaying] = useState(false)
  const keys = useRef(new Set<string>())
  const [resetPose, setResetPose] = useState(0)
  const [reset, setReset] = useState(0)
  const [mu, setMu] = useState(1)
  const analysis = useMemo(() => analyzeSwerve(config, rpm), [config, rpm])
  const motion = useMemo(
    () =>
      moduleStates(analysis.modules, ...(command as [number, number, number])),
    [analysis, command],
  )
  const renderable = analysis.modules.every(
    (m) =>
      Number.isFinite(m.x) &&
      Number.isFinite(m.y) &&
      Math.abs(m.x) < 10 &&
      Math.abs(m.y) < 10 &&
      m.diameter > 0 &&
      m.diameter < 2,
  )
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Drivebase lab</h2>
        <p className="text-muted-foreground">
          Inspect your configuration in 3D, try chassis commands, and review its
          theoretical envelope.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setView("perspective")}>
              Perspective
            </Button>
            <Button variant="outline" onClick={() => setView("top")}>
              Top view
            </Button>
            <Button variant="outline" onClick={() => setReset(reset + 1)}>
              Reset camera
            </Button>
            <Button
              variant="outline"
              disabled={!analysis.valid || !motion.known}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? "Pause simulation" : "Drive simulation"}
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setPlaying(false)
              setCommand([0, 0, 0])
              setResetPose(resetPose + 1)
            }}
          >
            Reset position
          </Button>
          {renderable ? (
            <Scene
              modules={analysis.modules}
              motion={motion}
              view={view}
              reset={reset}
              playing={playing && analysis.valid && motion.known}
              resetPose={resetPose}
            />
          ) : (
            <div className="rounded-lg border p-10">
              Correct invalid or extreme geometry to render the drivebase.
              Locations use inches, not millimeters.
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Drag to orbit · Scroll to zoom. +X forward, +Y left, positive
            rotation counterclockwise viewed from above. The camera follows the
            driving chassis; the blue trail records its path on a 0.5 m grid. An
            unbounded practice plane models ideal no-slip motion from the
            configured wheel states. Deck and mounts are illustrative; wheel
            diameter and module centers use your configuration.
          </p>
        </div>
        <div className="space-y-5">
          <h3 className="font-semibold">Robot-relative command</h3>
          <div
            role="group"
            aria-label="Keyboard driving"
            tabIndex={0}
            className="rounded border p-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-600"
            onKeyDown={(e) => {
              const key = e.key.toLowerCase()
              if (!["w", "a", "s", "d", "q", "e", " "].includes(key)) return
              e.preventDefault()
              if (key === " ") {
                keys.current.clear()
                setCommand([0, 0, 0])
                setPlaying(false)
                return
              }
              if (keys.current.has(key)) return
              keys.current.add(key)
              const k = keys.current
              setCommand([
                (Number(k.has("w")) - Number(k.has("s"))) * 2,
                (Number(k.has("a")) - Number(k.has("d"))) * 2,
                (Number(k.has("q")) - Number(k.has("e"))) * 2,
              ])
              setPlaying(true)
            }}
            onKeyUp={(e) => {
              if (!keys.current.delete(e.key.toLowerCase())) return
              const k = keys.current
              setCommand([
                (Number(k.has("w")) - Number(k.has("s"))) * 2,
                (Number(k.has("a")) - Number(k.has("d"))) * 2,
                (Number(k.has("q")) - Number(k.has("e"))) * 2,
              ])
            }}
            onBlur={() => {
              keys.current.clear()
              setCommand([0, 0, 0])
              setPlaying(false)
            }}
          >
            Click here to drive: W/S forward/back, A/D strafe, Q/E rotate.
            Release to stop; Space pauses. Or use the sliders and Drive
            simulation below.
          </div>
          {["Forward (m/s)", "Left (m/s)", "Rotation (rad/s)"].map(
            (label, i) => (
              <label key={label} className="block text-sm">
                {label}: {command[i].toFixed(1)}
                <input
                  className="mt-2 w-full"
                  type="range"
                  min={i === 2 ? -20 : -10}
                  max={i === 2 ? 20 : 10}
                  step="0.1"
                  value={command[i]}
                  onChange={(e) =>
                    setCommand(
                      command.map((v, j) =>
                        i === j ? Number(e.target.value) : v,
                      ),
                    )
                  }
                />
              </label>
            ),
          )}
          <div className="flex flex-wrap gap-2">
            {[
              ["Forward", [1, 0, 0]],
              ["Strafe", [0, 1, 0]],
              ["Spin", [0, 0, 2]],
              ["Combined", [2, 1, 3]],
              ["Stop", [0, 0, 0]],
            ].map(([name, values]) => (
              <Button
                key={String(name)}
                variant="outline"
                size="sm"
                onClick={() => {
                  setCommand(values as number[])
                  if (name === "Stop") setPlaying(false)
                }}
              >
                {name as string}
              </Button>
            ))}
          </div>
          <p role="status" className="text-sm">
            {!analysis.valid
              ? "Resolve configuration errors before relying on this preview."
              : !motion.known
                ? "Unbounded preview: motor free speed is missing."
                : motion.scale < 1
                  ? `Command exceeds wheel limits. All velocities scaled to ${(motion.scale * 100).toFixed(0)}% to preserve direction.`
                  : "Command is within the ideal wheel speed limits."}
          </p>
          <dl className="grid grid-cols-2 gap-4 border-t pt-4">
            <div>
              <dt className="text-sm text-muted-foreground">
                Pure translation
              </dt>
              <dd className="text-xl font-semibold">
                {fmt(analysis.maxSpeed, "m/s")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Pure rotation</dt>
              <dd className="text-xl font-semibold">
                {fmt(analysis.maxOmega, "rad/s")}
              </dd>
            </div>
          </dl>
          <label className="block text-sm">
            Assumed tire friction coefficient μ
            <Input
              type="number"
              min="0"
              max="3"
              step="0.05"
              value={mu}
              onChange={(e) => setMu(Number(e.target.value))}
            />
          </label>
          <p className="text-sm">
            Traction-only acceleration ceiling:{" "}
            <strong>
              {fmt(
                Number.isFinite(mu) && mu > 0 && mu <= 3 ? mu * 9.80665 : null,
                "m/s²",
              )}
            </strong>
            . This is μg, not a motor torque or tipping calculation.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="mb-2 text-left font-semibold">
            Module states after uniform desaturation
          </caption>
          <thead>
            <tr>
              {[
                "Module",
                "Position (in)",
                "Steering",
                "Requested",
                "Displayed",
                "Free speed",
              ].map((h) => (
                <th key={h} className="p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analysis.modules.map((m, i) => (
              <tr key={m.key} className="border-t">
                <td className="p-2">
                  <button className="underline" onClick={() => onEdit(m.key)}>
                    {m.key}
                  </button>
                </td>
                <td className="p-2">
                  {config.modules[m.key].location.front},{" "}
                  {config.modules[m.key].location.left}
                </td>
                <td className="p-2">
                  {fmt((motion.states[i].angle * 180) / Math.PI, "°")}
                </td>
                <td className="p-2">
                  {fmt(motion.states[i].requestedSpeed, "m/s")}
                </td>
                <td className="p-2">{fmt(motion.states[i].speed, "m/s")}</td>
                <td className="p-2">{fmt(m.speed, "m/s")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold">Configuration checks</h3>
        {analysis.findings.length === 0 ? (
          <p>
            No issues found by these checks. Verify calibration and hardware
            before driving.
          </p>
        ) : (
          <ul className="space-y-2">
            {analysis.findings.map((f, i) => (
              <li key={i} className="text-sm">
                <strong
                  className={
                    f.severity === "error"
                      ? "text-destructive"
                      : "text-amber-700 dark:text-amber-400"
                  }
                >
                  {f.severity === "error" ? "Error" : "Review"}:{" "}
                </strong>
                {f.message}{" "}
                <button onClick={() => onEdit(f.tab)} className="underline">
                  Review setting
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-semibold">
          Assumptions and motor free speeds
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-sm">
            12 V, no load, ideal gearing and no slip. Free speed = motor RPM ÷
            60 ÷ reduction × π × wheel diameter. Translation uses the slowest
            wheel; rotation uses the smallest wheel-speed / distance-to-origin
            ratio. Combined motion uses vx − ωy and vy + ωx, then scales all
            wheels together. Module gearing overrides shared gearing. Actual
            speed is lower under load; voltage sag, torque, efficiency, steering
            response, mass, center of gravity and tipping are not modeled.
            Inversion and encoder offsets require hardware calibration and do
            not change ideal kinematic directions.
          </p>
          <p className="text-sm">
            NEO V1 defaults to{" "}
            <a
              className="underline"
              href="https://docs.revrobotics.com/brushless/neo/v1.1/neo-v1"
            >
              REV’s 5676 RPM
            </a>
            . Other motor types require a verified RPM. Overrides and friction
            are preview-only and are not exported.{" "}
            <a
              className="underline"
              href="https://docs.wpilib.org/en/stable/docs/software/kinematics-and-odometry/swerve-drive-kinematics.html"
            >
              WPILib kinematics reference
            </a>
            .
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODULE_KEYS.map((key) => (
              <label key={key} className="text-sm">
                {key} · {config.modules[key].drive.type} · RPM
                <Input
                  type="number"
                  min="1"
                  value={
                    rpm[key] ?? motorRPM(config.modules[key].drive.type) ?? ""
                  }
                  placeholder="Enter verified free speed"
                  onChange={(e) =>
                    setRPM({
                      ...rpm,
                      [key]:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
        </div>
      </details>
    </section>
  )
}
