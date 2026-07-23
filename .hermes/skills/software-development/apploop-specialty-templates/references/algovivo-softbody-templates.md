# Algovivo Soft-Body Specialty Templates

Use with [algovivo](https://juniorrojas.com/algovivo/) (WASM neo-Hookean triangles + controllable muscles). AppLoop example: `templates/algovivo-creature`.

## Vendor assets

Prefer local copies:

- `public/vendor/algovivo/algovivo.min.js`
- `public/vendor/algovivo/algovivo.wasm`

Load with `import(/* webpackIgnore: true */ href)` + `WebAssembly.instantiateStreaming` (arrayBuffer fallback).

## system.set must include rest shape

```ts
system.set({
  pos,
  triangles,
  muscles,
  l0,  // muscle rest lengths
  rsi, // per-triangle inv([b-a | c-a])
})
```

**Pitfall — stick collapse:** omitting `rsi` destroys triangle rest shape. Result looks like sparse joint sticks + optional floating face dots. Recompute when regenerating geometry:

```python
Dm = np.column_stack([pb - pa, pc - pa])
if abs(np.linalg.det(Dm)) > 1e-7:
    rsi = np.linalg.inv(Dm)
```

Pass `vertexDepths` / sorted depths into `SystemViewport` when available.

## Controllers

| Approach | When |
|----------|------|
| Pretrained `nn.MLPPolicy` | Real forward locomotion. Works on the exact trained mesh **or an augmented superset** (append geometry AFTER the policy's vertex/muscle index range, pass `numVertices`/`numMuscles` caps so the policy sees only its original sub-view) |
| Scripted `system.a.set(arr)` | Decorative motion only (tail sway, jiggle, stepping in place) — measured ≤0.007 u/s forward across 40+ gait sweeps; never ships as \"walking\" |

**`MLPPolicy` defaults `active: false`** — it silently writes a=1 unless constructed with `active: true`. A policy-driven sim that stands still is almost always this.

**Augmentation tax:** appended appendage inertia slows the trained walk (official quadruped 1.71 u/s → tall raised tail 0.26 → compact low 3-vert tail ≈0.96). Keep add-ons small/low and measure headlessly (Node: `file://` import of `algovivo.min.js`, `WebAssembly.instantiate(fs.readFileSync(wasm))`, track COM x at 30Hz).

Meaning of `a`:

- `1` = relaxed rest length
- `<1` = contract toward fraction of `l0`

**Speed — user vocabulary → knobs:**

| User says | Set |
|---|---|
| "anxious" / "too fast" | SIM_HZ 16–18, `h ≈ 0.022–0.028`, gait speed ~0.9 |
| "normal" (default expectation) | SIM_HZ 30, `h = 0.033`, gait speed ~1.3 |
| "too slow" | keep 30Hz, raise gait speed, not Hz |
| "too elastic / wobbly" | raise activations toward 1, shrink body-sine amplitudes to ~0.004–0.01 — don't lower `h` |

Always use a fixed-step accumulator (max 2 steps/frame, render only if stepped). Never step once per RAF (~60 Hz) with default `h≈0.033` — that is the "anxious" bug. Don't go below 16Hz or `h < 0.022` — motion turns elastic/thrashy.

## SystemViewport neon paint

Constructor options (not CSS) drive mesh colors:

- `borderColor` — structure + joints
- `fillColor` — triangle fill (the body color)
- `gridColor`, `backgroundCenterColor`, `backgroundOuterColor`
- `activeMuscleColor` / `inactiveMuscleColor` — `#rrggbb` or RGB array

Recipes (all user-accepted at some point):

- Cool creature: joints `#67e8f9`, active muscle `#ff4fd8`, idle `#7c3aed`, dark blue stage
- Citrus orange: joints `#ffb347`, active `#b8ff4a`, idle `#62c41a`, warm dark stage
- Spot robot dog: fill `#f5c400`, edges `#111111`, active `#ff5a1f`, dark gray stage
- **Black cat (latest accepted):** fill `#0d0d0f`, edges `#0a0a0a`, active `#ff2a3a`, idle `#8a1520`, red-tinted dark stage (`#120c0e`/`#0a0708`, grid `#3a1518`)

Framing:

```ts
viewport.tracker.visibleWorldWidth = 5.6 // larger => smaller subject (default ~3.8)
viewport.tracker.targetCenterY = 1.05
```

## Layout

- Left: title, bullets, HUD (counts, state, legend)
- Right: stage only
- Skip face overlays unless requested
- Split components: `*-scene.tsx` (WASM/loop, audit-ignore) + `*-sidebar.tsx` (copy + HUD via runtime callback)

## Mesh generation loop

1. Silhouette primitives (rings, columns, leaves, stem, ears, tail)
2. Fan non-degenerate triangles for volume
3. Muscles only on actuators (limb ladders / radial squish / leaf midribs / tail chain)
4. Emit `l0`, `rsi`, optional `depth`
5. Write `public/data/.../mesh.json` **and** `lib/creature-mesh.ts` constants (bundled, no boot fetch race)
6. Muscle meta groups must match index order for gait
7. Typecheck + rsync seeded workspace

**Density rule (hard-won):** ~40–50 verts / ~50 tris reads clean. 70+ verts with hand-made triangulation reads as "noise" and collapses visually. Torso = convex hull + 1–2 core verts fanned; legs = hip→knee→ankle→toe chains with one lateral offset vert for thickness; feet start at y≈0.06.

## Shape pivots seen in product

- Generic ragdoll → official quadruped mesh+rsi (holds volume)
- Elephant columns/trunk → rejected as noise (121 verts)
- Soft orange + stem/leaves → jiggle/sway controller, citrus neon palette
- Spot robot dog v1 (73v) → "too much noise"; simplified 39v/39t accepted
- **Natural cat (48v/55t/39m):** arched flexible spine, ears, tapered tail, slim legs; black body + red neon actuators; 30Hz normal speed — latest accepted direction

## Verification

```bash
npm --prefix templates/algovivo-creature run typecheck
npm --prefix templates/algovivo-creature run lint
npm test -- tests/project-management.test.ts tests/generated-code-standards.test.ts
```

Visual acceptance: filled silhouette, coherent joints, calm natural motion, uncluttered stage, drag-and-drop enabled.
