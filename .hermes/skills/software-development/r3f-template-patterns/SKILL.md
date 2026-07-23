---
name: r3f-template-patterns
description: "Use when creating or editing React Three Fiber (R3F) / Three.js components in generated AppLoop templates: type fixes, eslint workarounds, data architecture, post-processing, and audit integration."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [r3f, threejs, templates, react, shaders, post-processing]
    related_skills: [generated-app-standards, frontend-design, project-runtime]
---

# R3F Template Patterns

## Overview

React Three Fiber (R3F) components in generated AppLoop templates require three specific patterns that conflict with standard React lint rules and template conventions. Apply all three when creating or editing an R3F scene component.

## When to Use

- Creating a new R3F/Three.js component for any AppLoop template.
- A template's R3F component fails `npm run typecheck` with `TS2339: Property does not exist on type 'JSX.IntrinsicElements'`.
- A template's R3F component fails `npm run lint` with `react-hooks/refs`, `react-hooks/immutability`, or `react-hooks/purity`.
- A template with R3F deps (`three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`) needs a new animated scene.

## 0. React 19 + R3F Version Compatibility (CRITICAL)

**R3F v8 does NOT work with React 19.** The error is:

```
TypeError: Cannot read properties of undefined (reading 'ReactCurrentOwner')
    at module evaluation (components/curiosity-hero.tsx:6:1)
    import { Canvas, useFrame, useThree } from "@react-three/fiber";
```

R3F v8 relied on `ReactCurrentOwner`, an internal API removed in React 19. The fix is upgrading to v9+.

### Required version matrix for React 19 templates

| Package | React 18 | React 19 |
|---------|----------|----------|
| `@react-three/fiber` | `^8.15.0` | `^9.6.1` (peer: `react >=19 <19.3`) |
| `@react-three/drei` | `^9.122.0` | `^10.7.7` (peer: `react ^19`, fiber `^9.0.0`) |
| `@react-three/postprocessing` | `^2.x` | `^3.0.4` (peer: `react ^19.0`, fiber `^9.0.0`) |
| `three` | any | `^0.174.0` (satisfies `>=0.156` for fiber v9, `>=0.159` for drei v10) |

When upgrading in a template:
```bash
# In the template directory, update package.json then:
npm install
npm run typecheck
npm run lint
```

If a template has both `@react-three/fiber` v8 and `react` 19, the build will break at runtime (not compile time) with `ReactCurrentOwner`.

## 1. JSX Type Fix (R3F v8 only)

With R3F v9 and `@react-three/drei` v10, JSX intrinsic elements are properly augmented and the `r3f.d.ts` shim is usually unnecessary. Keep the file if `tsc` reports `TS2339: Property does not exist on type 'JSX.IntrinsicElements'` for `<mesh>`, `<points>`, or `<shaderMaterial>`.

For v8 templates that still need it, create `types/r3f.d.ts` in the template root:

```typescript
import type { ThreeElements } from "@react-three/fiber";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
```

This file is picked up automatically by the template's `tsconfig.json` `include` pattern (`**/*.tsx` and `**/*.ts`). Do NOT use `/// <reference types="..." />` or global augmentations — `declare module "react"` is the only pattern that reliably bridges the types in the `moduleResolution: "bundler"` configuration.

## 2. ESLint Hooks Rules vs R3F

The template ESLint config enforces `react-hooks/refs`, `react-hooks/immutability`, and `react-hooks/purity`. These all conflict with standard R3F patterns.

### Rules that hit every R3F file

| Rule | Why it fires | Can it be avoided? |
|------|-------------|---------------------|
| `react-hooks/refs` | Reading `materialRef.current` in JSX props, assigning refs in `useMemo`/`useState` initializers | NO — this is the standard R3F API. Disable file-wide. |
| `react-hooks/immutability` | Mutating `material.uniforms.uTime.value` in `useFrame` | YES — use `useRef` for material (not `useMemo` or `useState`). Ref mutations are not tracked by this rule. |
| `react-hooks/purity` | Calling `Math.random()` in `useMemo` callback | YES — use deterministic hash functions (e.g., `hash3D(i, seed, 0)`) for particle initialization. |
| `react-hooks/set-state-in-effect` | Calling `setState` in `useEffect` to store THREE objects | YES — use `useRef` with constructor call as initializer, or `useMemo` for geometry. |

**Required fix**: Add this at the top of EVERY R3F scene component file:

```typescript
/* eslint-disable react-hooks/refs */
```

This is the only rule that cannot be worked around — passing ref-held material/geometry as JSX props is the standard R3F API. The other three rules can be avoided with the data architecture below.

## 3. R3F Data Architecture for Animated Scenes

Mutable data accessed in `useFrame` (particle positions, velocities, sizes, material uniforms) must live in refs, not React state. Writing to state from `useFrame` triggers re-renders every frame and kills performance.

### Verified component pattern

```typescript
"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

function Scene() {
  const pointsRef = useRef<THREE.Points>(null!);

  // Mutable animation data — accessed and mutated in useFrame
  const simRef = useRef<{
    positions: Float32Array;
    velocities: Float32Array;
    sizes: Float32Array;
    targets: Float32Array;
  }>(null!);

  // Material in a ref — uniforms mutated in useFrame
  const materialRef = useRef<THREE.ShaderMaterial>(
    new THREE.ShaderMaterial({
      vertexShader: `...`,
      fragmentShader: `...`,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  // Geometry via useMemo — created once, never modified after
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const velocities = new Float32Array(COUNT * 3);
    const targets = new Float32Array(COUNT * 3);

    for (let i = 0; i < COUNT; i++) {
      // Use deterministic seeding, NOT Math.random()
      positions[i * 3] = /* ... */;
      sizes[i] = 1.0 + hash3D(i * 0.1, 0, 0) * 0.5;
      velocities[i * 3] = (hash3D(i, 1, 0) - 0.5) * 0.02;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    simRef.current = { positions, velocities, sizes, targets };
    return geo;
  }, []);

  useFrame((state, delta) => {
    const sim = simRef.current;
    const material = materialRef.current;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    // ... mutate sim.positions, sim.velocities, sim.sizes
    pointsRef.current.geometry.getAttribute("position").needsUpdate = true;
  });

  return (
    <>
      <points ref={pointsRef} geometry={geometry} material={materialRef.current} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.15} intensity={0.55} mipmapBlur />
        <Vignette darkness={0.45} offset={0.1} />
      </EffectComposer>
    </>
  );
}

export function Wrapper() {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 55 }} dpr={[1, 2]}>
      <Scene />
    </Canvas>
  );
}
```

### Key rules

- **Geometry**: `useMemo` with `[]` deps. Set sim ref inside the memo callback. Return the geometry.
- **Material**: `useRef` with the `new THREE.ShaderMaterial(...)` call as the initializer argument. Never create material in `useEffect` + `setState` — hits `set-state-in-effect`.
- **Sim arrays**: `useRef` storing `{ positions, velocities, sizes, targets }`. Assign inside `useMemo`. Access via `simRef.current` in `useFrame`.
- **Point sizes**: `new THREE.BufferAttribute(sizes, 1)` — itemSize is 1 for per-point scalar sizes, not 3.
- **Buffer upload**: Set `.needsUpdate = true` on position and size attributes each frame after mutation.
- **Mouse tracking**: Add pointer event listeners on `gl.domElement` in a `useEffect`. Convert to world coordinates: `worldX = ndcX * viewport.width * 0.5`.
- **Reduced motion**: Use `useState` with a lazy initializer reading `window.matchMedia("(prefers-reduced-motion: reduce)")`, plus a `useEffect` for the change listener. When reduced motion is active, render a static fallback instead of the Canvas.

## 4. Audit Integration

### Ignore R3F files in the classname audit

Every R3F scene component file must be added to the `ignored` Set in `tests/generated-code-standards.test.ts` → `collectTemplateUiFiles`. R3F JSX elements (`<mesh>`, `<points>`, `<group>`, etc.) don't carry classNames and will trigger false "missing className" failures.

### Deterministic seeding for particle initialization

The `react-hooks/purity` rule forbids `Math.random()` in `useMemo` callbacks. Use a deterministic hash function instead:

```typescript
function hash3D(x: number, y: number, z: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 45.164) * 43758.5453;
  return n - Math.floor(n);
}

// Usage: hash3D(particleIndex, seedChannel, 0)
sizes[i] = 1.0 + hash3D(i * 0.1, 0, 0) * 0.5;
velocityX = (hash3D(i, 1, 0) - 0.5) * 0.02;
```

This produces varied but deterministic values, satisfying both the lint rule and the need for visual variety.

## 5. Custom Particle Shaders (GLSL Pitfalls)

### `gl_PointCoord` is fragment-only

`gl_PointCoord` exists only in the **fragment** shader. Assigning it in the vertex shader fails at link time:

```
THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false
VERTEX ERROR: 'gl_PointCoord' : undeclared identifier
```

**Wrong** (vertex):
```glsl
varying vec2 vUv;
void main() {
  vUv = gl_PointCoord; // FAIL — fragment-only built-in
}
```

**Right** (fragment uses it directly):
```glsl
// fragment
void main() {
  vec2 uv = gl_PointCoord - 0.5;
}
```

### Fake motion blur without stock `MotionBlur`

`@react-three/postprocessing` v3 does **not** export `MotionBlur`. Use an `aSpeed` buffer attribute:

1. Each frame: `speeds[i] = length(velocity)`.
2. Vertex: scale `gl_PointSize` by `1.0 + clamp(aSpeed * k, 0.0, cap)`.
3. Fragment: stretch `gl_PointCoord` UV (`uv.x *= stretch`) and add a soft trail alpha.

Mark `aSpeed.needsUpdate = true` each frame.

## 6. Highly Responsive Cursor + Shockwave Physics

When the brief wants particles that **bend / stretch / orbit / repel** with inertia and click shockwaves:

| Concern | Pattern |
|---------|--------|
| Pointer inertia | Store `tx/ty` from events; exp-smooth into `x/y` (`follow = 1 - exp(-k*dt)`); derive `vx/vy` |
| Influence radius | Soft falloff + radius grows with `mouseSpeed` |
| Orbit + repel | Unit normal particle→cursor; tangential `(-ny, nx)` + radial repel |
| Velocity imprint | Add `cursor.vx/vy * influence` so flicks shear the field |
| Spring vs cursor | Scale formation spring by `(1 - mouseMask)` so nearby particles obey the cursor |
| Shockwaves | Ring at `easeOutExpo(age/life) * R`; force band of width; optional swirl; store click `strength` |
| Formation morph | `smootherstep` blend + `sin(p*π)` radial inflate during transitions |
| Energy / camera | Aggregate energy drives CA intensity + soft camera parallax/Z punch |
| Monochrome | Particles stay white; CA only as faint RGB fringe — no colored fills unless brief asks |

Recipe detail: [`references/responsive-particle-field.md`](references/responsive-particle-field.md).

## Verification Checklist

- [ ] Template `package.json` uses R3F v9+ / drei v10+ / postprocessing v3+ if React 19 is in deps (see section 0).
- [ ] `types/r3f.d.ts` exists if R3F v8; may be omitted for v9+ unless tsc reports missing JSX intrinsics.
- [ ] R3F scene file has `/* eslint-disable react-hooks/refs */` at the top.
- [ ] Geometry created via `useMemo([], [])`, not `useState` or `useEffect`.
- [ ] Material created via `useRef(new THREE.ShaderMaterial(...))`, not `useMemo` or `useEffect` + `setState`.
- [ ] Sim arrays stored in `useRef`, assigned inside `useMemo`.
- [ ] No `Math.random()` calls in `useMemo` — use `hash3D` instead.
- [ ] `BufferAttribute` for per-point sizes uses itemSize 1.
- [ ] `.needsUpdate = true` set on position/size attributes each frame (and `aSpeed` if used).
- [ ] Custom particle GLSL: `gl_PointCoord` only in fragment shader.
- [ ] Post-processing (`EffectComposer`) is inside the R3F scene, not in the Canvas wrapper.
- [ ] Monochrome fields: white particles; CA only as subtle fringe unless brief wants color.
- [ ] R3F scene filename added to the `ignored` Set in the audit test.
- [ ] `npm run typecheck` and `npm run lint` both pass **in the template directory**.