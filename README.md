# YAGSL Config Generator

A form-based tool for generating the JSON config files [YAGSL](https://github.com/Yet-Another-Software-Suite/YAGSL) expects in `src/main/deploy/swerve`, plus a step-by-step guide for actually getting a swerve robot tuned and running with them. No YAML/JSON hand-editing, no guessing at what field names YAGSL wants.

Live at whatever GitHub Pages URL this repo is deployed to. Runs entirely in the browser — nothing is sent to a server, the zip is built and downloaded client-side.

## Stack

- Next.js (App Router, static export via `output: "export"`) — this is a client-side app with no backend, exported to static HTML/JS and served from GitHub Pages
- React + TypeScript
- Tailwind CSS + shadcn/ui (Radix primitives) for the components
- JSZip + file-saver for building and downloading the config zip, and reading one back in on upload
- pnpm for package management

Because this ships as a static export, there's no API routes, no server components doing real work, no database. Everything — config state, zip generation, validation — happens in the browser.

### GitHub Pages basePath

GitHub Pages serves this repo at `https://<org>.github.io/yagsl2027_config_generator/`, not at the domain root, so every absolute asset path needs that repo name prefixed on or it 404s. `next.config.mjs` computes this automatically from `GITHUB_REPOSITORY` when running in Actions (empty locally). `next/link` and the router pick this up on their own; anything that emits a raw path string — `next/image` with `unoptimized: true`, `metadata.icons` — doesn't, so those use the `withBasePath()` helper in `lib/base-path.ts` instead. If this ever moves to its own domain, `basePath` collapses to `""` and `withBasePath` becomes a no-op — nothing else needs to change.

## Two halves of this app

**The config generator** (`/`, i.e. `app/page.tsx`) — the form itself. Seven tabs: Gyro, the four modules, Properties (physical + PIDF), and 3D & Checks. Edit here if you're changing what fields the generator collects, adding a new motor/encoder/gyro type, or changing what goes into the exported zip.

- `app/page.tsx` — top-level state (the whole `ConfigData` object lives here), tab navigation, download/upload buttons, mascot header
- `components/gyro-config.tsx`, `module-config.tsx`, `physical-properties.tsx`, `pidf-properties.tsx` — one form per tab
- `lib/types.ts` — the TypeScript shape of the config. This should always match the JSON Schemas below
- `lib/zip-utils.ts` — `generateZip()` builds the zip (swervedrive.json + modules/*.json) and triggers the download; `uploadZip()` reads a zip back into form state, with `validateConfig()` doing basic sanity checks so a malformed upload fails with a useful error instead of silently corrupting the form
- `public/schemas/*.json` — the actual YAGSL JSON Schemas (swervedrive, module, physicalproperties, pidfproperties). These are the source of truth for valid enum values (gyro types, motor types, encoder types, etc). If YAGSL adds a new motor controller or encoder type, it shows up here first, and the dropdowns in the form components need updating to match.

If a dropdown is missing an option YAGSL supports, or the exported JSON doesn't match what YAGSL's schema expects, this is the half to fix.

**The Quick Start Guide** (`/guide`, i.e. `app/guide/page.tsx`) — walks a user through what to do with the zip they just downloaded: setting up the YAGSL example project, running in sim, connecting to a real robot, measuring module locations, aligning absolute encoders, tuning PID, verifying on the field, and ongoing maintenance. This is FRC-domain instructional content, not config-generation logic.

- `components/tuning-guide.tsx` — all the guide logic: the 9 tabs, step sequencing within each tab, the skip/back/next flow, and the `#hash` deep-linking so a URL can be copy-pasted to jump straight to a specific step
- `components/tuning-step.tsx` — the individual step/checklist UI each tab is built from
- `components/*-animation.tsx`, `module-location-diagram.tsx`, `tuning-comparison.tsx`, `json-diff.tsx` — visual aids embedded in specific steps (module rotation animation, gyro CCW+ check, field alignment, before/after PID comparisons, etc.)

If something's wrong with the instructions themselves — a step is in the wrong order, a diagram is misleading, a doc link is stale — this is the half to fix. If you're adding a new step, add its id to both the tab's step array and `TAB_STEPS` in `tuning-guide.tsx`.

## Local dev

```
pnpm install
pnpm dev
```

`pnpm run build` does the static export into `out/`, which is what actually gets deployed. `next.config.mjs` has `typescript.ignoreBuildErrors: true`, so a bad build won't fail on type errors alone — run `pnpm exec tsc --noEmit` if you want that check.

Deployment is automatic on push to `main` via `.github/workflows/nextjs.yml` — installs with `pnpm install --frozen-lockfile` (never `pnpm update` in CI; that silently ignores the lockfile), builds, and pushes `out/` to GitHub Pages.

## Drivebase lab

The final **3D & Checks** tab reads the same configuration used by the forms and ZIP export. Orbit/zoom the Three.js scene, switch to top view, drive the chassis across a practice grid, or try forward, strafe, spin and combined commands. Module centers and wheel diameters are dimensionally accurate; deck/mount geometry is illustrative. The accessible state table remains available when WebGL is unavailable.

The calculator uses inches for configuration geometry and SI units for motion. Per-module gearing takes precedence over shared gearing. Ideal free speed is `RPM / 60 / reduction * π * diameter`; pure translation is limited by the slowest wheel and pure rotation by the minimum `wheel speed / module radius`. Combined robot-relative commands use `(vx - ωy, vy + ωx)` and uniform wheel-speed desaturation. +X is forward, +Y is left, and positive rotation is counterclockwise from above. See [WPILib kinematics](https://docs.wpilib.org/en/stable/docs/software/kinematics-and-odometry/swerve-drive-kinematics.html).

Only NEO V1 has a built-in free-speed value ([REV: 5676 RPM at 12 V](https://docs.revrobotics.com/brushless/neo/v1.1/neo-v1)). Other motors require an explicit verified RPM in the assumptions panel; missing data is shown as unavailable rather than assigned another motor's limits. RPM overrides and friction are local preview assumptions and never alter exported JSON. The traction ceiling is `μg`; loaded speed, torque/current behavior, voltage sag, center of gravity, tipping and steering dynamics are not simulated. Encoder offset/inversion correctness requires hardware testing.

Errors (nonpositive gearing, nonfinite geometry, coincident/collinear module layout, invalid addresses/gains/current limits, or inconsistent module file references) block download and direct the user to the checks. Heuristic warnings (unusual dimensions/reductions/speeds/current, quadrant mismatch, swept wheel overlap, large offsets and shared addresses) remain reviewable without blocking export. Shared CAN IDs are warnings because different device families may have independent address spaces. These checks do not certify a robot as safe or competition legal.

Validation:

```sh
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

The driving simulation recovers chassis velocity from the desaturated module vectors with least-squares forward kinematics, including asymmetric layouts, then integrates the robot-relative twist into field position and heading. The camera follows the robot over an unbounded 0.5 m practice grid with a bounded path trail. Drive/pause, reset position, and a focusable W/A/S/D + Q/E keyboard pad control motion. Releasing keys stops keyboard commands; leaving the pad pauses. Invalid configurations or unknown wheel limits disable driving. Motion is ideal no-slip kinematics, without acceleration, obstacles or collision physics.

Browser tests exercise the live form, 3D canvas, commands, invalid export guard, mobile layout and successful ZIP download. Screenshots are written to ignored `test-results/`.
