"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import type { analyzeSwerve, moduleStates } from "@/lib/swerve-analysis"

type Props = {
  modules: ReturnType<typeof analyzeSwerve>["modules"]
  motion: ReturnType<typeof moduleStates>
  view: "perspective" | "top"
  reset: number
  playing: boolean
}
const colors = [0x2563eb, 0x0f766e, 0xb45309, 0x9333ea]

export default function SwerveScene({
  modules,
  motion,
  view,
  reset,
  playing,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const savedCamera = useRef<{
    key: string
    position: THREE.Vector3
    target: THREE.Vector3
  } | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
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
    controls.update()
    scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 3))
    const light = new THREE.DirectionalLight(0xffffff, 3)
    light.position.set(2, 4, 3)
    scene.add(light)
    const grid = new THREE.GridHelper(span * 5, 20, 0x94a3b8, 0xcbd5e1)
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
    scene.add(deck)
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
      scene.add(sprite)
    }
    const rolling: { group: THREE.Group; rate: number }[] = []
    modules.forEach((m, i) => {
      const state = motion.states[i]
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
      rolling.push({ group: roll, rate: state.speed / (m.diameter / 2) })
      scene.add(group)
      const mount = box(0.07, 0.06, 0.07, colors[i])
      mount.position.set(m.x, 0.17, -m.y)
      scene.add(mount)
      if (state.speed > 0.001)
        scene.add(
          new THREE.ArrowHelper(
            new THREE.Vector3(Math.cos(state.angle), 0, -Math.sin(state.angle)),
            new THREE.Vector3(m.x, 0.25, -m.y),
            Math.min(span * 2, 0.12 + state.speed * 0.1),
            colors[i],
            0.07,
            0.04,
          ),
        )
      label(["FL", "FR", "BL", "BR"][i], m.x, 0.36, -m.y)
    })
    scene.add(
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
    scene.add(
      new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(0, 0.24, 0),
        span * 0.65,
        0x0f766e,
        0.06,
        0.035,
      ),
    )
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
      const dt = previous ? Math.min((time - previous) / 1000, 0.05) : 0
      previous = time
      rolling.forEach((w) => (w.group.rotation.z -= w.rate * dt))
      render()
      frame = requestAnimationFrame(animate)
    }
    if (playing) frame = requestAnimationFrame(animate)
    const lost = (event: Event) => {
      event.preventDefault()
      setError(true)
    }
    renderer.domElement.addEventListener("webglcontextlost", lost)
    return () => {
      cancelAnimationFrame(frame)
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
  }, [modules, motion, view, reset, playing])
  return (
    <div>
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
