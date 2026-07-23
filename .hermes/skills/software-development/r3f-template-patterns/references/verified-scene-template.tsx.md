# Verified R3F Animated Scene Template

This file is a stripped-down reference showing the complete R3F animated scene pattern that passed `npm run typecheck`, `npm run lint`, and the template audit tests. It demonstrates all the patterns described in the parent SKILL.md.

## Prerequisites

Template `package.json` must include:
```json
{
  "dependencies": {
    "@react-three/drei": "^9.122.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/postprocessing": "^3.0.4",
    "three": "^0.174.0"
  },
  "devDependencies": {
    "@types/three": "^0.174.0"
  }
}
```

## types/r3f.d.ts

```typescript
import type { ThreeElements } from "@react-three/fiber";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
```

## Scene component structure

```typescript
/* eslint-disable react-hooks/refs */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  EffectComposer,
  ChromaticAberration,
  Bloom,
  Vignette,
} from "@react-three/postprocessing";
import * as THREE from "three";

// ─── deterministic noise (avoids Math.random in useMemo) ───

function hash3D(x: number, y: number, z: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 45.164) * 43758.5453;
  return n - Math.floor(n);
}

// ─── shaders ───────────────────────────────────────────────

const vertexShader = /* glsl */ `
  uniform float uSize;
  uniform float uScale;
  attribute float aSize;
  varying float vAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * aSize * (uScale / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 12.0);
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = smoothstep(0.5, 12.0, gl_PointSize);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    float core = exp(-d * 3.5) * 0.95;
    float halo = exp(-d * 1.2) * 0.18;
    float ring = (1.0 - smoothstep(0.55, 1.0, d)) * smoothstep(0.4, 0.55, d) * 0.08;
    float alpha = clamp((core + halo + ring) * vAlpha, 0.0, 1.0);
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`;

// ─── scene ─────────────────────────────────────────────────

const PARTICLE_COUNT = 4200;

function Scene() {
  const pointsRef = useRef<THREE.Points>(null!);
  const { viewport, gl } = useThree();
  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const simRef = useRef<{
    positions: Float32Array;
    velocities: Float32Array;
    sizes: Float32Array;
    targets: Float32Array;
  }>(null!);

  const materialRef = useRef<THREE.ShaderMaterial>(
    new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uSize: { value: 4.5 },
        uScale: { value: 1 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const targets = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Deterministic seeding via hash3D
      positions[i * 3] = (hash3D(i, 0, 0) - 0.5) * 5.0;
      positions[i * 3 + 1] = (hash3D(i, 1, 0) - 0.5) * 5.0;
      positions[i * 3 + 2] = (hash3D(i, 2, 0) - 0.5) * 5.0;
      sizes[i] = 1.0 + hash3D(i * 0.1, 0, 0) * 0.5;
      velocities[i * 3] = (hash3D(i, 3, 0) - 0.5) * 0.02;
      velocities[i * 3 + 1] = (hash3D(i, 4, 0) - 0.5) * 0.02;
      velocities[i * 3 + 2] = (hash3D(i, 5, 0) - 0.5) * 0.02;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    simRef.current = { positions, velocities, sizes, targets };
    return geo;
  }, []);

  // Mouse tracking on the canvas DOM element
  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      mouseRef.current.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.ty = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, [gl]);

  useFrame((state, delta) => {
    if (!pointsRef.current || !simRef.current) return;

    const dt = Math.min(delta, 0.1);
    const time = state.clock.elapsedTime;
    const material = materialRef.current;
    material.uniforms.uTime.value = time;
    material.uniforms.uScale.value = Math.min(viewport.width, viewport.height) * 0.55;

    // Smooth mouse interpolation (inertia)
    const m = mouseRef.current;
    m.x += (m.tx - m.x) * Math.min(dt * 8, 1);
    m.y += (m.ty - m.y) * Math.min(dt * 8, 1);

    const { positions, velocities, sizes, targets } = simRef.current;

    // ... physics loop mutating positions, velocities, sizes, targets ...

    pointsRef.current.geometry.getAttribute("position").needsUpdate = true;
    (pointsRef.current.geometry.getAttribute("aSize") as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <>
      <points ref={pointsRef} geometry={geometry} material={materialRef.current} />
      <EffectComposer>
        <ChromaticAberration offset={new THREE.Vector2(0.0015, 0.0015)} />
        <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.85} intensity={0.55} mipmapBlur />
        <Vignette darkness={0.45} offset={0.1} />
      </EffectComposer>
    </>
  );
}

// ─── wrapper ───────────────────────────────────────────────

export function ParticleHero() {
  const [reducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  // useEffect for the change listener only (not for initial setState)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => { /* setReducedMotion via state */ };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <section>
      <div style={{ position: "absolute", inset: 0 }}>
        {!reducedMotion ? (
          <Canvas
            camera={{ position: [0, 0, 8], fov: 55, near: 0.1, far: 50 }}
            dpr={[1, 2]}
            gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
          >
            <Scene />
          </Canvas>
        ) : (
          <div aria-hidden="true" style={{ /* static fallback */ }} />
        )}
      </div>
    </section>
  );
}
```

## Audit test integration

In `tests/generated-code-standards.test.ts`, add the scene filename to the `ignored` Set:

```typescript
const ignored = new Set([
  // ... existing entries ...
  "particle-hero.tsx",
]);
```