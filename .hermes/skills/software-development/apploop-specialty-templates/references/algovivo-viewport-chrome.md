# Algovivo viewport chrome polish

Lessons from the yellow neural-walker cat / space stage:

## Transparent canvas + starfield

```ts
// SystemViewport options
borderColor: '#0a0a0a',        // black mesh edges
fillColor: '#f5c400',
gridColor: 'rgba(0,0,0,0)',
backgroundColor: 'rgba(0,0,0,0)',
activeMuscleColor: '#ff2a3a',
inactiveMuscleColor: '#8a1520',
```

CSS on `.algovivo-viewport` paints the universe (nebulas + star layers). Canvas must clear to transparent so that paints through.

## Kill the floor line (when edges are black)

Algovivo constructs the floor with `color: borderColor`. Black edges ⇒ black floor slash across the stage.

```ts
if (viewport.floor?.mesh) {
  viewport.floor.mesh.lines = []
  if (viewport.floor.mesh.lineShader) {
    viewport.floor.mesh.lineShader.renderLine = () => {}
  }
}
```

Type the optional `floor` on `AlgovivoViewport`.

## Boot thrash

Symptoms: first 1–2 seconds look double-speed / flaily, then settles.

Fixes (stack them):

1. `MAX_SIM_STEPS_PER_FRAME = 1` (never 2+ catch-up on a laggy first frame)
2. If `now - lastSimAt > 1.5 * SIM_DT_MS`, snap `lastSimAt = now - SIM_DT_MS` (drop debt)
3. Before attaching the RAf loop: `SETTLE_STEPS` with all activations `1`
4. After resize/DOM attach, zero `startedAt` / `lastSimAt` / `simTimeSeconds` so boot wall-clock is not replayed

## Legend + HUD microcopy

- Black swatch on dark HUD needs white outline, not just `color: #0a0a0a`
- Longer status strings (`walking`) get smaller font than tall numbers
- UI copy should say **black edges**, not blue neon, when edges are black

## Tail attachment

For official quadruped base mesh, rear-side verts (e.g. 3 and 4 near the rump) attach a raised compact tail better than mid-back top verts (0/1). Keep chain short; appendage inertia slows the trained walk.
