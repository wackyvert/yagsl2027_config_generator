import { test, expect } from "@playwright/test"
test("3D preview, commands, configuration changes, export guard and mobile layout", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto("/")
  await page.getByRole("tab", { name: "3D & Checks" }).click()
  await expect(page.locator("canvas")).toBeVisible()
  await expect(page.getByText("4.47 m/s", { exact: true })).toHaveCount(5)
  await page.getByRole("button", { name: "Spin", exact: true }).click()
  await expect(
    page.getByRole("cell", { name: "135.00 °", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Top view", exact: true }).click()
  await page.getByRole("button", { name: "Combined", exact: true }).click()
  await page.screenshot({
    path: "test-results/drivebase-desktop.png",
    fullPage: true,
  })
  await page.getByRole("tab", { name: "Properties", exact: true }).click()
  await page.locator("input[type=number]").nth(0).fill("0")
  await page
    .getByRole("button", { name: "Download Config", exact: true })
    .click()
  await expect(page.getByRole("tab", { name: "3D & Checks" })).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await expect(
    page.getByText("Correct configuration errors before export", {
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.getByText("Unavailable", { exact: true })).toHaveCount(6)
  await page.getByRole("tab", { name: "Properties", exact: true }).click()
  await page.locator("input[type=number]").nth(0).fill("6.75")
  await page.getByRole("tab", { name: "3D & Checks" }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: "test-results/drivebase-mobile.png",
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  const download = page.waitForEvent("download")
  await page
    .getByRole("button", { name: "Download Config", exact: true })
    .click()
  expect((await download).suggestedFilename()).toBe("swerve-config.zip")
  expect(errors).toEqual([])
})

test("uploaded module overrides and unknown motor assumptions stay out of exports", async ({
  page,
}) => {
  const { default: JSZip } = await import("jszip")
  const { fixture } = await import("../config-fixture")
  const config = structuredClone(fixture)
  config.modules.frontleft.drive.type = "talonfx_krakenx60"
  config.modules.frontleft.gearing = {
    drive: { gearRatio: 13.5, diameter: 4 },
    angle: { gearRatio: 12.8 },
  }
  const zip = new JSZip()
  zip.file("swervedrive.json", JSON.stringify(config.swervedrive))
  for (const [key, value] of Object.entries(config.modules))
    zip.file(`modules/${key}.json`, JSON.stringify(value))
  zip.file(
    "modules/physicalproperties.json",
    JSON.stringify(config.physicalproperties),
  )
  zip.file("modules/pidfproperties.json", JSON.stringify(config.pidfproperties))
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles({
    name: "swerve.zip",
    mimeType: "application/zip",
    buffer: await zip.generateAsync({ type: "nodebuffer" }),
  })
  await expect(
    page.getByText("Configuration loaded successfully", { exact: true }),
  ).toBeVisible()
  await page.getByRole("tab", { name: "3D & Checks" }).click()
  await expect(
    page.getByText("Unbounded preview: motor free speed is missing."),
  ).toBeVisible()
  await page
    .getByText("Assumptions and motor free speeds", { exact: true })
    .click()
  await page.getByRole("spinbutton", { name: /frontleft.*RPM/ }).fill("5676")
  await expect(page.getByText("2.24 m/s", { exact: true })).toHaveCount(2)
  await page
    .getByRole("button", { name: "Drive simulation", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Pause simulation", exact: true }),
  ).toBeVisible()
  const pending = page.waitForEvent("download")
  await page
    .getByRole("button", { name: "Download Config", exact: true })
    .click()
  const file = await (await pending).path()
  const fs = await import("node:fs/promises")
  const exported = await JSZip.loadAsync(await fs.readFile(file!))
  const module = JSON.parse(
    await exported.file("modules/frontleft.json")!.async("text"),
  )
  expect(module.gearing.drive.gearRatio).toBe(13.5)
  expect(module.rpm).toBeUndefined()
  expect(module.drive.type).toBe("talonfx_krakenx60")
})

test("WebGL failure preserves the accessible state table", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type.startsWith("webgl")) return null
      return (original as Function).apply(this, [type, ...args])
    } as typeof original
  })
  await page.goto("/")
  await page.getByRole("tab", { name: "3D & Checks" }).click()
  await expect(
    page.getByRole("alert").filter({ hasText: "3D rendering is unavailable" }),
  ).toBeVisible()
  await expect(page.getByRole("table")).toBeVisible()
  await page.getByRole("button", { name: "Spin", exact: true }).click()
  await expect(
    page.getByRole("cell", { name: "135.00 °", exact: true }),
  ).toBeVisible()
})

test("simulation drives, pauses, resets and supports keyboard steering", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("tab", { name: "3D & Checks" }).click()
  const pose = page.getByLabel("Simulated pose")
  await expect(pose).toContainText("X 0.00 m")
  await page
    .getByRole("button", { name: "Drive simulation", exact: true })
    .click()
  await expect
    .poll(async () => Number((await pose.innerText()).match(/X ([\d.-]+)/)![1]))
    .toBeGreaterThan(0.15)
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click()
  const paused = await pose.innerText()
  await page.getByRole("button", { name: "Top view", exact: true }).click()
  await expect(pose).toHaveText(paused)
  await page
    .getByRole("button", { name: "Reset position", exact: true })
    .click()
  await expect(pose).toContainText("X 0.00 m · Y 0.00 m · Heading 0.0°")
  await page
    .getByRole("group", { name: "Keyboard driving", exact: true })
    .focus()
  await page.keyboard.down("q")
  await expect
    .poll(async () =>
      Number((await pose.innerText()).match(/Heading ([\d.-]+)/)![1]),
    )
    .toBeGreaterThan(5)
  await page.keyboard.up("q")
  await page.getByRole("button", { name: "Stop", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Drive simulation", exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: "test-results/driving-simulation.png",
    fullPage: true,
  })
})

test("slow rendering preserves drive speed and direction changes reuse the canvas", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window)
    const cancel = window.cancelAnimationFrame.bind(window)
    let id = 0
    const pending = new Map<number, { timer: number; frame?: number }>()
    window.requestAnimationFrame = (callback) => {
      const key = ++id
      const entry = {
        timer: window.setTimeout(() => {
          entry.frame = raf((time) => {
            pending.delete(key)
            callback(time)
          })
        }, 125),
        frame: undefined as number | undefined,
      }
      pending.set(key, entry)
      return key
    }
    window.cancelAnimationFrame = (key) => {
      const entry = pending.get(key)
      if (entry) {
        clearTimeout(entry.timer)
        if (entry.frame) cancel(entry.frame)
        pending.delete(key)
      }
    }
  })
  await page.goto("/")
  await page.getByRole("tab", { name: "3D & Checks" }).click()
  const canvas = await page.locator("canvas").elementHandle()
  const pose = page.getByLabel("Simulated pose")
  await expect(pose).toContainText("X 0.00 m")
  await page
    .getByRole("button", { name: "Drive simulation", exact: true })
    .click()
  await expect
    .poll(async () => Number((await pose.innerText()).match(/X ([\d.-]+)/)![1]))
    .toBeGreaterThan(0.1)
  const sample = () =>
    page.evaluate(() => ({
      time: performance.now(),
      x: Number(
        document
          .querySelector('[aria-label="Simulated pose"]')!
          .textContent!.match(/X ([\d.-]+)/)![1],
      ),
    }))
  const start = await sample()
  await expect
    .poll(async () => (await sample()).time - start.time)
    .toBeGreaterThan(1200)
  const end = await sample()
  const speed = (end.x - start.x) / ((end.time - start.time) / 1000)
  expect(speed).toBeGreaterThan(0.8)
  expect(speed).toBeLessThan(1.2)
  await page.getByRole("button", { name: "Strafe", exact: true }).click()
  expect(await canvas!.evaluate((node) => node.isConnected)).toBe(true)
  await page.getByRole("button", { name: "Stop", exact: true }).click()
})
