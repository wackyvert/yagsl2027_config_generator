"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import type { analyzeSwerve, moduleStates } from "@/lib/swerve-analysis"

import { advancePose, chassisVelocity, origin } from "@/lib/swerve-simulation"

type Props = {
  modules: ReturnType<typeof analyzeSwerve>["modules"]
  motion: ReturnType<typeof moduleStates>
  view: "perspective" | "top"
  reset: number
  playing: boolean
  resetPose: number
}
const colors = [0x2563eb, 0x0f766e, 0xb45309, 0x9333ea]

export default function SwerveScene({
  modules,
  motion,
  view,
  reset,
  playing,
  resetPose,
}: Props) {
  const updateMotion = useRef<
    ((motion: Props["motion"], playing: boolean) => void) | null
  >(null)
  const live = useRef({ motion, playing })
  useEffect(() => {
    live.current = { motion, playing }
    updateMotion.current?.(motion, playing)
  }, [motion, playing])
  const pose = useRef(origin())
  const poseReset = useRef(resetPose)
  const telemetry = useRef<HTMLOutputElement>(null)
  const path = useRef<THREE.Vector3[]>([])
  const host = useRef<HTMLDivElement>(null)
  const savedCamera = useRef<{
    key: string
    position: THREE.Vector3
    target: THREE.Vector3
  } | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (poseReset.current !== resetPose) {
      pose.current = origin()
      path.current = []
      savedCamera.current = null
      poseReset.current = resetPose
    }
    const element = host.current!
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      setError(true)
      return
    }
    setError(false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0xeaf0f6)
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D drivebase. Drag to orbit; scroll to zoom. Use view buttons for keyboard navigation.",
    )
    element.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const robot = new THREE.Group()
    scene.add(robot)
    robot.position.set(pose.current.x, 0, -pose.current.y)
    robot.rotation.y = pose.current.heading
    let velocity = chassisVelocity(modules, live.current.motion.states)
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100)
    const span = Math.max(
      0.5,
      ...modules.flatMap((m) => [Math.abs(m.x), Math.abs(m.y)]),
    )
    camera.position.set(
      ...((view === "top"
        ? [0, span * 5, 0.001]
        : [span * 3, span * 2.5, span * 3]) as [number, number, number]),
    )
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.08, 0)
    controls.minDistance = 0.2
    controls.maxDistance = span * 12
    controls.maxPolarAngle = Math.PI / 2 - 0.01
    const cameraKey = `${view}:${reset}`
    if (savedCamera.current?.key === cameraKey) {
      camera.position.copy(savedCamera.current.position)
      controls.target.copy(savedCamera.current.target)
    }
    if (savedCamera.current?.key !== cameraKey) {
      camera.position.add(robot.position)
      controls.target.add(robot.position)
    }
    controls.update()
    scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 3))
    const light = new THREE.DirectionalLight(0xffffff, 3)
    light.position.set(2, 4, 3)
    scene.add(light)
    const grid = new THREE.GridHelper(40, 80, 0x94a3b8, 0xcbd5e1)
    scene.add(grid)
    const material = (color: number) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.2 })
    const box = (w: number, h: number, d: number, color: number) =>
      new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color))
    const maxX = Math.max(...modules.map((m) => m.x)),
      minX = Math.min(...modules.map((m) => m.x))
    const maxY = Math.max(...modules.map((m) => m.y)),
      minY = Math.min(...modules.map((m) => m.y))
    const deck = box(
      Math.max(0.05, maxX - minX),
      0.045,
      Math.max(0.05, maxY - minY),
      0x64748b,
    )
    deck.position.set((minX + maxX) / 2, 0.17, -(minY + maxY) / 2)
    robot.add(deck)
    const label = (text: string, x: number, y: number, z: number) => {
      const canvas = document.createElement("canvas")
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext("2d")!
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, 256, 64)
      ctx.fillStyle = "#0f172a"
      ctx.font = "bold 28px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(text, 128, 42)
      const texture = new THREE.CanvasTexture(canvas)
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, depthTest: false }),
      )
      sprite.scale.set(span * 0.55, span * 0.14, 1)
      sprite.position.set(x, y, z)
      robot.add(sprite)
    }
    const rolling: {
      group: THREE.Group
      steering: THREE.Group
      arrow: THREE.ArrowHelper
      rate: number
    }[] = []
    modules.forEach((m, i) => {
      const state = live.current.motion.states[i]
      const group = new THREE.Group()
      group.position.set(m.x, m.diameter / 2, -m.y)
      group.rotation.y = state.angle
      const roll = new THREE.Group()
      group.add(roll)
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(
          m.diameter / 2,
          m.diameter / 2,
          m.diameter * 0.42,
          32,
        ),
        material(0x1e293b),
      )
      wheel.rotation.x = Math.PI / 2
      roll.add(wheel)
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(
          m.diameter * 0.25,
          m.diameter * 0.25,
          m.diameter * 0.46,
          24,
        ),
        material(colors[i]),
      )
      hub.rotation.x = Math.PI / 2
      roll.add(hub)
      for (const side of [-1, 1]) {
        const spoke = box(m.diameter * 0.8, m.diameter * 0.08, 0.003, 0xe2e8f0)
        spoke.position.z = side * m.diameter * 0.24
        roll.add(spoke)
      }

      robot.add(group)
      const mount = box(0.07, 0.06, 0.07, colors[i])
      mount.position.set(m.x, 0.17, -m.y)
      robot.add(mount)
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(Math.cos(state.angle), 0, -Math.sin(state.angle)),
        new THREE.Vector3(m.x, 0.25, -m.y),
        Math.min(span * 2, 0.12 + state.speed * 0.1),
        colors[i],
        0.07,
        0.04,
      )
      arrow.visible = state.speed > 0.001
      robot.add(arrow)
      rolling.push({
        group: roll,
        steering: group,
        arrow,
        rate: state.speed / (m.diameter / 2),
      })
      label(["FL", "FR", "BL", "BR"][i], m.x, 0.36, -m.y)
    })
    robot.add(
      new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0.24, 0),
        span * 0.65,
        0xdc2626,
        0.06,
        0.035,
      ),
    )
    label("+X forward", span * 0.65, 0.34, 0)
    robot.add(
      new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(0, 0.24, 0),
        span * 0.65,
        0x0f766e,
        0.06,
        0.035,
      ),
    )
    const trailGeometry = new THREE.BufferGeometry()
    const trailPositions = new THREE.BufferAttribute(new Float32Array(3000), 3)
    trailGeometry.setAttribute("position", trailPositions)
    const trail = new THREE.Line(
      trailGeometry,
      new THREE.LineBasicMaterial({ color: 0x2563eb }),
    )
    scene.add(trail)
    trail.frustumCulled = false
    const updateTrail = () => {
      path.current.forEach((p, i) => trailPositions.setXYZ(i, p.x, p.y, p.z))
      trailPositions.needsUpdate = true
      trailGeometry.setDrawRange(0, path.current.length)
    }
    updateTrail()
    const updateTelemetry = () => {
      if (telemetry.current)
        telemetry.current.textContent = `X ${pose.current.x.toFixed(2)} m · Y ${pose.current.y.toFixed(2)} m · Heading ${((pose.current.heading * 180) / Math.PI).toFixed(1)}°`
    }
    updateTelemetry()
    const render = () => renderer.render(scene, camera)
    const resize = () => {
      const width = element.clientWidth
      renderer.setSize(width, 420)
      camera.aspect = width / 420
      camera.updateProjectionMatrix()
      render()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    controls.addEventListener("change", render)
    resize()
    let frame = 0,
      previous = 0
    const animate = (time: number) => {
      const dt = previous ? (time - previous) / 1000 : 0
      previous = time
      if (!document.hidden) {
        const old = robot.position.clone()
        pose.current = advancePose(pose.current, velocity, dt)
        robot.position.set(pose.current.x, 0, -pose.current.y)
        robot.rotation.y = pose.current.heading
        const displacement = robot.position.clone().sub(old)
        camera.position.add(displacement)
        controls.target.add(displacement)
        // An unbounded practice plane: recenter the grid in whole 0.5 m cells.
        grid.position.set(
          Math.round(pose.current.x * 2) / 2,
          0,
          -Math.round(pose.current.y * 2) / 2,
        )
        rolling.forEach((w) => (w.group.rotation.z -= w.rate * dt))
        const point = new THREE.Vector3(pose.current.x, 0.005, -pose.current.y)
        if (
          !path.current.length ||
          point.distanceTo(path.current[path.current.length - 1]) > 0.03
        ) {
          path.current.push(point)
          if (path.current.length > 1000) path.current.shift()
          updateTrail()
        }
        updateTelemetry()
      }
      render()
      frame = requestAnimationFrame(animate)
    }
    let running = false
    const applyMotion = (next: Props["motion"], play: boolean) => {
      velocity = chassisVelocity(modules, next.states)
      rolling.forEach((wheel, i) => {
        const state = next.states[i]
        wheel.rate = state.speed / (modules[i].diameter / 2)
        wheel.steering.rotation.y = state.angle
        wheel.arrow.visible = state.speed > 0.001
        wheel.arrow.setDirection(
          new THREE.Vector3(Math.cos(state.angle), 0, -Math.sin(state.angle)),
        )
        wheel.arrow.setLength(
          Math.min(span * 2, 0.12 + state.speed * 0.1),
          0.07,
          0.04,
        )
      })
      if (play !== running) {
        cancelAnimationFrame(frame)
        previous = 0
        running = play
        if (play) frame = requestAnimationFrame(animate)
      }
      render()
    }
    // Hidden-tab time is deliberately excluded, without discarding slow visible frames.
    const visibility = () => {
      previous = 0
    }
    document.addEventListener("visibilitychange", visibility)
    updateMotion.current = applyMotion
    applyMotion(live.current.motion, live.current.playing)
    const lost = (event: Event) => {
      event.preventDefault()
      setError(true)
    }
    renderer.domElement.addEventListener("webglcontextlost", lost)
    return () => {
      cancelAnimationFrame(frame)
      updateMotion.current = null
      document.removeEventListener("visibilitychange", visibility)
      savedCamera.current = {
        key: cameraKey,
        position: camera.position.clone(),
        target: controls.target.clone(),
      }
      observer.disconnect()
      controls.dispose()
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Sprite ||
          object instanceof THREE.LineSegments ||
          object instanceof THREE.Line
        ) {
          object.geometry?.dispose()
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material]
          materials.forEach((m: THREE.Material & { map?: THREE.Texture }) => {
            m.map?.dispose()
            m.dispose()
          })
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [modules, view, reset, resetPose])
  return (
    <div>
      <output
        ref={telemetry}
        aria-label="Simulated pose"
        className="block py-2 text-sm"
      />
      <div ref={host} className="overflow-hidden rounded-lg" />
      {error && (
        <p role="alert">
          3D rendering is unavailable. Enable WebGL or use the module state
          table below.
        </p>
      )}
    </div>
  )
}
