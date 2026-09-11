"use client"

import { useState } from "react"
import { optimizeWheel } from "@/lib/swerve-simulation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SWERVE_LESSONS } from "@/lib/swerve-lessons"
import {
  MODULE_KEYS,
  type analyzeSwerve,
  type moduleStates,
} from "@/lib/swerve-analysis"

type Props = {
  analysis: ReturnType<typeof analyzeSwerve>
  motion: ReturnType<typeof moduleStates>
  command: number[]
  reduction: number
  onReduction: (value: number) => void
  onExperiment: (command: number[]) => void
}
const number = (n: number) =>
  Number.isFinite(n) ? n.toFixed(2) : "unavailable"

export function SwerveStudentLab({
  analysis,
  motion,
  command,
  reduction,
  onReduction,
  onExperiment,
}: Props) {
  const [lessonIndex, setLessonIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [moduleIndex, setModuleIndex] = useState(0)
  const [currentAngle, setCurrentAngle] = useState(0)
  const lesson = SWERVE_LESSONS[lessonIndex]
  const module = analysis.modules[moduleIndex]
  const state = motion.states[moduleIndex]
  const optimized = optimizeWheel(
    state.angle,
    state.speed,
    (currentAngle * Math.PI) / 180,
  )
  const rotationX = -command[2] * module.y
  const rotationY = command[2] * module.x
  return (
    <details open className="rounded-lg border p-4 space-y-4">
      <summary className="cursor-pointer text-lg font-semibold">
        Student workshop
      </summary>
      <p className="text-sm text-muted-foreground">
        Predict, run, explain. These experiments affect this preview only; your
        exported configuration stays unchanged.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3" aria-label="Guided experiments">
          <label className="block text-sm">
            Choose an experiment
            <select
              className="mt-1 w-full rounded border bg-background p-2"
              value={lessonIndex}
              onChange={(e) => {
                setLessonIndex(Number(e.target.value))
                setRevealed(false)
              }}
            >
              {SWERVE_LESSONS.map((item, i) => (
                <option key={item.id} value={i}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <p className="font-medium">{lesson.prediction}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onExperiment([...lesson.command])}>
              Load experiment
            </Button>
            <Button variant="outline" onClick={() => setRevealed(!revealed)}>
              {revealed ? "Hide explanation" : "Reveal explanation"}
            </Button>
          </div>
          {revealed && (
            <p className="text-sm" role="status">
              {lesson.explanation}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Load resets the robot to the origin and pauses. Make your
            prediction, then press Drive simulation. Watch the module state
            table and path.
          </p>
          <label className="block text-sm">
            Preview drive reduction multiplier: {reduction.toFixed(2)}×
            <input
              type="range"
              className="mt-2 w-full"
              min="0.5"
              max="2"
              step="0.25"
              value={reduction}
              onChange={(e) => onReduction(Number(e.target.value))}
            />
          </label>
          <p className="text-sm">
            At {reduction.toFixed(2)}× the configured reduction, ideal free
            speed is {(100 / reduction).toFixed(0)}% of baseline. At the same
            motor torque, ideal wheel torque is {(100 * reduction).toFixed(0)}%.
            Actual acceleration still depends on traction, current limits, mass,
            and losses.
          </p>
          <Button size="sm" variant="outline" onClick={() => onReduction(1)}>
            Restore configured gearing
          </Button>
        </section>
        <section className="space-y-3" aria-label="Wheel vector inspector">
          <label className="block text-sm">
            Inspect a module
            <select
              className="mt-1 w-full rounded border bg-background p-2"
              value={moduleIndex}
              onChange={(e) => setModuleIndex(Number(e.target.value))}
            >
              {MODULE_KEYS.map((key, i) => (
                <option key={key} value={i}>
                  {key}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm">
            Module position: x = {number(module.x)} m forward, y ={" "}
            {number(module.y)} m left. Positive ω is counterclockwise.
          </p>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-medium">Translation contribution (vx, vy)</dt>
              <dd>
                ({number(command[0])}, {number(command[1])}) m/s
              </dd>
            </div>
            <div>
              <dt className="font-medium">Rotation contribution (−ωy, +ωx)</dt>
              <dd>
                ({number(rotationX)}, {number(rotationY)}) m/s
              </dd>
            </div>
            <div>
              <dt className="font-medium">Sum: wheel vector before limiting</dt>
              <dd>
                ({number(command[0] + rotationX)},{" "}
                {number(command[1] + rotationY)}) m/s
              </dd>
            </div>
            <div>
              <dt className="font-medium">Magnitude and steering direction</dt>
              <dd>
                √(x² + y²) = {number(state.requestedSpeed)} m/s; atan2(y, x) ={" "}
                {number((state.angle * 180) / Math.PI)}°
              </dd>
            </div>
            <div>
              <dt className="font-medium">
                After uniform wheel-speed limiting
              </dt>
              <dd>
                {motion.known
                  ? `${number(state.requestedSpeed)} × ${number(motion.scale)} = ${number(state.speed)} m/s`
                  : "Unavailable until each motor free speed is known."}
              </dd>
            </div>
          </dl>
          <p className="text-sm text-muted-foreground">
            When any wheel exceeds its free-speed ceiling, every vector gets the
            same scale factor. Clamping each wheel separately would change the
            intended chassis motion. At zero speed, steering angle is arbitrary;
            this preview displays 0°.
          </p>
          <div className="space-y-2 border-t pt-3">
            <h3 className="font-semibold">
              Why reverse instead of steering 180°?
            </h3>
            <label className="block text-sm">
              Assumed current steering angle (degrees)
              <Input
                type="number"
                step="1"
                value={currentAngle}
                onChange={(e) => setCurrentAngle(Number(e.target.value))}
              />
            </label>
            <p className="text-sm">
              Shortest equivalent target:{" "}
              {number((optimized.angle * 180) / Math.PI)}°; steering change:{" "}
              {number((optimized.delta * 180) / Math.PI)}°; signed drive speed:{" "}
              {number(optimized.speed)} m/s.
            </p>
            <p className="text-sm text-muted-foreground">
              If steering would exceed 90°, reversing the wheel gives the same
              velocity vector with less steering. Try a backward command with
              the current angle at 0°. This comparison uses your assumed angle;
              it does not model steering motor response.
            </p>
          </div>
        </section>
      </div>
    </details>
  )
}
