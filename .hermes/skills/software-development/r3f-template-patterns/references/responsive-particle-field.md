# Responsive Monochrome Particle Field (stay-curious class)

Canonical live template: `templates/stay-curious/components/curiosity-hero.tsx`.

## Package matrix (React 19)

```
@react-three/fiber ^9.6.1
@react-three/drei ^10.7.7
@react-three/postprocessing ^3.0.4
three ^0.174.0
```

R3F v8 + React 19 → runtime `ReactCurrentOwner` crash.

## Sim buffers

- `positions`, `velocities`, `targets` — float × 3 × N
- `sizes`, `speeds` — float × 1 × N (`aSize`, `aSpeed` attributes)
- N ≈ 8k–10k with single-pass CPU physics + clamping `dt ≤ 0.05`

## Cursor physics knobs (starting points)

```
MOUSE_INFLUENCE_RADIUS = 5.2   // grows with cursor speed
MOUSE_FORCE / ORBIT / REPULSE  // high enough to overpower formation spring nearby
MOUSE_FOLLOW = 14              // exp smooth
SPRING_FORCE = 1.55            // weaker when morphing / under mouseMask
DAMPING = 2.85                 // lower near mouse so motion lingers
SHOCKWAVE_LIFE ≈ 3.2
SHOCKWAVE_FORCE ≈ 16
FORMATION_BLEND_SPEED ≈ 0.22
```

## Per-frame order

1. Smooth pointer + velocity  
2. Advance formation timer / smootherstep `t` + morph pulse  
3. Write blended `targets` (optional radial inflate)  
4. Age/cull shockwaves  
5. For each particle: mouse forces → masked spring → wave rings → damping → turbulence → integrate → write `speeds[i]`  
6. Energy EMA → camera parallax → dynamic CA vector  
7. Mark buffer attributes `needsUpdate`

## Shader contract

- Vertex: size from `uSize * aSize * speedBoost * (uScale / -mvPosition.z)`
- Fragment: `uv = gl_PointCoord - 0.5`, stretch UV by speed, core + halo + glass ring, depth fade
- **Never** sample `gl_PointCoord` in vertex

## Post stack (monochrome cinematic)

```tsx
<EffectComposer multisampling={0}>
  <ChromaticAberration offset={caOffset} radialModulation modulationOffset={0.35} />
  <Bloom luminanceThreshold={0.08} luminanceSmoothing={0.85} intensity={0.72} mipmapBlur />
  <Vignette darkness={0.55} offset={0.18} />
</EffectComposer>
```

No stock `MotionBlur` in postprocessing v3 exports — use `aSpeed` stretch instead.

## Fullscreen page chrome

Immerse templates: remove `SiteHeader` from layout, `html/body/app-shell` → `100dvh`, pure `#000` background, headline overlay `pointer-events: none`. Keep `template-stay-curious` on `<body>` and unique last classnames on hero boundaries.