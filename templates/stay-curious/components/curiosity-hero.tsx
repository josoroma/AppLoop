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

// ─── constants ────────────────────────────────────────────

const PARTICLE_COUNT = 10000;
const SCALE = 4.0;
const FORMATION_INTERVAL = 7.0;
const MOUSE_INFLUENCE_RADIUS = 5.2;
const MOUSE_FORCE = 16.0;
const MOUSE_ORBIT = 7.5;
const MOUSE_REPULSE = 5.2;
const MOUSE_FOLLOW = 14.0;
const SPRING_FORCE = 1.55;
const DAMPING = 2.85;
const SHOCKWAVE_LIFE = 3.2;
const SHOCKWAVE_FORCE = 16.0;
const FORMATION_BLEND_SPEED = 0.22;

// ─── noise helpers ────────────────────────────────────────

function hash3D(x: number, y: number, z: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 45.164) * 43758.5453;
  return n - Math.floor(n);
}

function noise3D(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);

  const n000 = hash3D(ix, iy, iz);
  const n100 = hash3D(ix + 1, iy, iz);
  const n010 = hash3D(ix, iy + 1, iz);
  const n110 = hash3D(ix + 1, iy + 1, iz);
  const n001 = hash3D(ix, iy, iz + 1);
  const n101 = hash3D(ix + 1, iy, iz + 1);
  const n011 = hash3D(ix, iy + 1, iz + 1);
  const n111 = hash3D(ix + 1, iy + 1, iz + 1);

  return (
    (1 - sz) *
      ((1 - sy) * ((1 - sx) * n000 + sx * n100) +
        sy * ((1 - sx) * n010 + sx * n110)) +
    sz *
      ((1 - sy) * ((1 - sx) * n001 + sx * n101) +
        sy * ((1 - sx) * n011 + sx * n111))
  );
}

function fbm(x: number, y: number, z: number, octaves = 3): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmp = 0;
  for (let o = 0; o < octaves; o++) {
    value += amplitude * noise3D(x * frequency, y * frequency, z * frequency);
    maxAmp += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value / maxAmp;
}

// ─── formations ───────────────────────────────────────────

type FormationFn = (
  i: number,
  total: number,
  time: number,
) => [number, number, number];

function fibonacciSphere(
  i: number,
  total: number,
): [number, number, number] {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / total);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  return [
    Math.cos(theta) * Math.sin(phi),
    Math.cos(phi),
    Math.sin(theta) * Math.sin(phi),
  ];
}

const formations: Record<string, FormationFn> = {
  sphere: (i, total, time) => {
    const [x, y, z] = fibonacciSphere(i, total);
    const n = fbm(x * 2, y * 2 + time * 0.12, z * 2, 2);
    const r = SCALE * (0.85 + n * 0.25);
    return [x * r, y * r, z * r];
  },

  vortex: (i, total, time) => {
    const [sx, sy, sz] = fibonacciSphere(i, total);
    const baseR = Math.sqrt(sx * sx + sz * sz);
    const baseTheta = Math.atan2(sz, sx);
    const twist = baseR * 3.0 + time * 0.35;
    const theta = baseTheta + twist;
    const y = sy * SCALE * 1.6;
    const r = SCALE * (0.35 + baseR * 1.3);
    const n = fbm(theta * 0.5, y * 0.3 + time * 0.08, r * 0.4, 2);
    return [
      Math.cos(theta) * (r + n * 0.45),
      y + n * 0.55,
      Math.sin(theta) * (r + n * 0.45),
    ];
  },

  tunnel: (i, total, time) => {
    const frac = i / total;
    const theta = frac * Math.PI * 10 + time * 0.45;
    const y = (frac - 0.5) * SCALE * 3.5;
    const r = SCALE * 0.65 + Math.sin(frac * Math.PI * 4 + time * 0.5) * 0.45;
    const n = fbm(theta * 0.4, y * 0.35 + time * 0.1, 0, 2);
    const rr = r + n * 0.55;
    return [Math.cos(theta) * rr, y, Math.sin(theta) * rr];
  },

  wave: (i, total) => {
    const side = Math.ceil(Math.sqrt(total));
    const col = i % side;
    const row = Math.floor(i / side);
    const x = (col / side - 0.5) * SCALE * 3;
    const z = (row / side - 0.5) * SCALE * 3;
    const dist = Math.sqrt(x * x + z * z);
    const y =
      Math.sin(dist * 3.0 - (i * 0.003)) * 1.5 +
      Math.cos(x * 3.5 + (i * 0.002)) * 0.7 +
      Math.sin(z * 4.0 - (i * 0.002)) * 0.7;
    return [x, y, z];
  },

  radial: (i, total, time) => {
    const [sx, sy, sz] = fibonacciSphere(i, total);
    const theta = Math.atan2(sz, sx);
    const phi = Math.acos(sy);
    const pulse = 1 + Math.sin(i * 0.04 - time * 0.7) * 0.4;
    const r = SCALE * pulse * (0.45 + phi / Math.PI);
    const n = fbm(theta * 2.5, phi * 2.5 + time * 0.12, r * 0.3, 2);
    return [
      Math.cos(theta) * Math.sin(phi) * (r + n * 0.35),
      Math.cos(phi) * (r + n * 0.35),
      Math.sin(theta) * Math.sin(phi) * (r + n * 0.35),
    ];
  },

  helix: (i, total, time) => {
    const frac = i / total;
    const theta = frac * Math.PI * 12 + time * 0.5;
    const r1 = SCALE * 1.2;
    const r2 = SCALE * 0.6;
    const y = (frac - 0.5) * SCALE * 3.5;
    const r = r1 + (r2 - r1) * Math.abs(y / (SCALE * 1.75));
    const offset = Math.sin(frac * Math.PI * 4) * 0.35;
    const n = fbm(theta * 0.6, y * 0.3 + time * 0.1, 0, 2);
    return [
      Math.cos(theta + offset) * (r + n * 0.3),
      y + n * 0.3,
      Math.sin(theta + offset) * (r + n * 0.3),
    ];
  },

  field: (i, total, time) => {
    const [sx, sy, sz] = fibonacciSphere(i, total);
    const x = sx * SCALE * 0.8;
    const y = sy * SCALE * 0.8;
    const z = sz * SCALE * 0.8;
    const flow =
      noise3D(x * 0.6 + time * 0.15, y * 0.6, z * 0.6 + time * 0.1) * 1.2 +
      noise3D(x * 1.2, y * 1.2 + time * 0.2, z * 1.2) * 0.6;
    const dx = Math.sin(y * 1.5 + flow) * 0.7;
    const dy = Math.cos(x * 1.5 + flow + 1) * 0.7;
    const dz = Math.sin(z * 1.5 + flow + 2) * 0.7;
    return [x + dx, y + dy, z + dz];
  },

  torus: (i, total, time) => {
    const [sx, sy, sz] = fibonacciSphere(i, total);
    const theta = Math.atan2(sz, sx);
    const phi = Math.acos(sy);
    const R = SCALE * 0.8 + Math.sin(phi * 3 + time * 0.3) * 0.3;
    const r = SCALE * 0.25 + Math.cos(phi * 5 + time * 0.4) * 0.1;
    const n = fbm(theta * 3, phi * 2 + time * 0.1, 0, 2);
    return [
      (R + r * Math.cos(phi * 8) + n * 0.2) * Math.cos(theta),
      (r * Math.sin(phi * 8) + n * 0.2),
      (R + r * Math.cos(phi * 8) + n * 0.2) * Math.sin(theta),
    ];
  },

  ribbon: (i, total, time) => {
    const frac = i / total;
    const theta = frac * Math.PI * 6;
    const r = SCALE * (0.6 + Math.sin(frac * Math.PI * 8 + time * 0.5) * 0.4);
    const y = (frac - 0.5) * SCALE * 3.0 + Math.sin(theta * 2 + time * 0.4) * 1.2;
    const sway = Math.cos(theta + time * 0.3) * 0.6;
    const n = fbm(theta * 0.7, y * 0.3 + time * 0.08, 0, 2);
    return [
      Math.cos(theta) * r + sway + n * 0.25,
      y + n * 0.35,
      Math.sin(theta) * r + n * 0.25,
    ];
  },
};

const formationKeys = Object.keys(formations);
const defaultFormation = formations.sphere;

// ─── GLSL shaders ─────────────────────────────────────────

const vertexShader = /* glsl */ `
  uniform float uSize;
  uniform float uScale;
  uniform float uTime;
  attribute float aSize;
  attribute float aSpeed;
  varying float vDist;
  varying float vAlpha;
  varying float vSpeed;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float dist = length(mvPosition.xyz);
    vDist = dist;
    vSpeed = aSpeed;
    // Velocity stretch: fast particles get larger/brighter streaks
    float speedBoost = 1.0 + clamp(aSpeed * 0.55, 0.0, 2.4);
    float pointSize = uSize * aSize * speedBoost * (uScale / -mvPosition.z);
    pointSize = clamp(pointSize, 0.35, 18.0);
    gl_PointSize = pointSize;
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = smoothstep(0.35, 16.0, pointSize);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vDist;
  varying float vAlpha;
  varying float vSpeed;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    // Anisotropic stretch along motion for fake motion blur (monochrome streaks)
    float stretch = 1.0 + clamp(vSpeed * 0.9, 0.0, 2.8);
    uv.x *= stretch;
    float d = length(uv) * 2.0;

    // Bright luminous core
    float core = exp(-d * 4.2) * 0.95;

    // Soft ethereal halo
    float halo = exp(-d * 1.15) * 0.28;

    // Glass-like refractive edge ring
    float ring = (1.0 - smoothstep(0.48, 1.0, d)) * smoothstep(0.28, 0.52, d) * 0.14;

    // Subtle chromatic fringe at edges (glass refraction) — keep near-white
    float chromaticEdge = smoothstep(0.55, 0.95, d) * (1.0 - smoothstep(0.95, 1.08, d));
    float rShift = chromaticEdge * 0.09;
    float bShift = chromaticEdge * 0.09;

    float alpha = (core + halo + ring) * vAlpha;
    // Motion-smear trail contribution
    alpha += exp(-d * (1.6 / stretch)) * clamp(vSpeed * 0.08, 0.0, 0.22) * vAlpha;
    alpha = clamp(alpha, 0.0, 1.0);

    // Pure white core with tiny RGB edge friction for CAA (still monochrome body)
    vec3 color = vec3(1.0);
    color.r = mix(color.r, 1.04, rShift);
    color.g = mix(color.g, 0.98, chromaticEdge * 0.35);
    color.b = mix(color.b, 1.04, bShift);

    // Depth fog: farther particles fade/soften
    float depthFade = 1.0 - smoothstep(1.5, 14.0, vDist) * 0.42;
    alpha *= depthFade;

    gl_FragColor = vec4(color, alpha);
  }
`;

// ─── sound-like shockwave ring helper ─────────────────────

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// ─── curiosity scene ──────────────────────────────────────

interface Shockwave {
  x: number;
  y: number;
  z: number;
  age: number;
  strength: number;
}

interface SimState {
  positions: Float32Array;
  velocities: Float32Array;
  sizes: Float32Array;
  targets: Float32Array;
  speeds: Float32Array;
}

function CuriosityScene() {
  const pointsRef = useRef<THREE.Points>(null!);
  const { viewport, gl } = useThree();
  const mouseRef = useRef({
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    vx: 0,
    vy: 0,
    px: 0,
    py: 0,
  });
  const shockwavesRef = useRef<Shockwave[]>([]);
  const formationRef = useRef({ index: 0, progress: 0, timer: 0 });
  const cameraWobbleRef = useRef({ x: 0, y: 0, z: 0 });
  const energyRef = useRef(0);
  const simRef = useRef<SimState>(null!);
  const caOffset = useMemo(() => new THREE.Vector2(0.0018, 0.0014), []);

  const materialRef = useRef<THREE.ShaderMaterial>(
    new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uSize: { value: 5.4 },
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
    const speeds = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const [x, y, z] = defaultFormation(i, PARTICLE_COUNT, 0);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      sizes[i] = 0.8 + hash3D(i * 0.1, 0, 0) * 0.7;
      velocities[i * 3] = (hash3D(i, 1, 0) - 0.5) * 0.015;
      velocities[i * 3 + 1] = (hash3D(i, 2, 0) - 0.5) * 0.015;
      velocities[i * 3 + 2] = (hash3D(i, 3, 0) - 0.5) * 0.015;
      speeds[i] = 0;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));

    simRef.current = { positions, velocities, sizes, targets, speeds };

    return geo;
  }, []);

  // ── pointer tracking ─────────────────────────────────
  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      mouseRef.current.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.ty = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const onClick = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const cy = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const worldX = cx * viewport.width * 0.5;
      const worldY = cy * viewport.height * 0.5;
      const m = mouseRef.current;
      const impulse = Math.min(
        1.8,
        0.85 + Math.hypot(m.vx, m.vy) * 0.18,
      );
      shockwavesRef.current.push({
        x: worldX,
        y: worldY,
        z: 0,
        age: 0,
        strength: impulse,
      });
      energyRef.current = Math.min(1.4, energyRef.current + 0.85);

      // Force immediate formation change with soft cinematic blend restart
      formationRef.current.timer = 0;
      formationRef.current.progress = 0;
      formationRef.current.index =
        (formationRef.current.index + 1) % formationKeys.length;
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("click", onClick);
    };
  }, [gl, viewport]);

  // ── animation loop ───────────────────────────────────
  useFrame((state, delta) => {
    if (!pointsRef.current || !simRef.current) return;

    const dt = Math.min(delta, 0.05);
    const time = state.clock.elapsedTime;
    const material = materialRef.current;
    material.uniforms.uTime.value = time;
    material.uniforms.uScale.value =
      Math.min(viewport.width, viewport.height) * 0.62;

    // Smooth mouse interpolation + velocity (inertia)
    const m = mouseRef.current;
    const prevX = m.x;
    const prevY = m.y;
    const follow = 1 - Math.exp(-MOUSE_FOLLOW * dt);
    m.x += (m.tx - m.x) * follow;
    m.y += (m.ty - m.y) * follow;
    const invDt = dt > 0.0001 ? 1 / dt : 60;
    const rawVx = (m.x - prevX) * invDt;
    const rawVy = (m.y - prevY) * invDt;
    m.vx += (rawVx - m.vx) * Math.min(dt * 18, 1);
    m.vy += (rawVy - m.vy) * Math.min(dt * 18, 1);
    m.px = prevX;
    m.py = prevY;

    const mx = m.x * viewport.width * 0.5;
    const my = m.y * viewport.height * 0.5;
    const mouseSpeed = Math.hypot(m.vx, m.vy);
    const dynamicRadius =
      MOUSE_INFLUENCE_RADIUS * (1 + Math.min(mouseSpeed * 0.08, 0.55));

    // Formation auto-cycling — cinematic ease (smootherstep)
    const fm = formationRef.current;
    fm.timer += dt;
    if (fm.timer > FORMATION_INTERVAL) {
      fm.timer = 0;
      fm.progress = 0;
      fm.index = (fm.index + 1) % formationKeys.length;
      energyRef.current = Math.min(1.2, energyRef.current + 0.35);
    }
    fm.progress = Math.min(fm.progress + dt * FORMATION_BLEND_SPEED, 1);

    const fromKey = formationKeys[fm.index];
    const toKey = formationKeys[(fm.index + 1) % formationKeys.length];
    const { positions, velocities, sizes, targets, speeds } = simRef.current;

    // Compute blended target positions with volume pulse during morph
    const p = fm.progress;
    const t = p * p * p * (p * (p * 6 - 15) + 10); // smootherstep
    const morphPulse = Math.sin(p * Math.PI) * 0.22;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const [fx, fy, fz] = formations[fromKey](i, PARTICLE_COUNT, time);
      const [tx, ty, tz] = formations[toKey](i, PARTICLE_COUNT, time);
      const bx = fx + (tx - fx) * t;
      const by = fy + (ty - fy) * t;
      const bz = fz + (tz - fz) * t;
      // Gentle radial inflate during transition for cinematic volume
      targets[i * 3] = bx * (1 + morphPulse);
      targets[i * 3 + 1] = by * (1 + morphPulse);
      targets[i * 3 + 2] = bz * (1 + morphPulse);
    }

    // Update shockwaves
    const sw = shockwavesRef.current;
    for (let s = sw.length - 1; s >= 0; s--) {
      sw[s].age += dt;
      if (sw[s].age > SHOCKWAVE_LIFE) {
        sw.splice(s, 1);
      }
    }

    // Physics update per particle
    let localEnergy = 0;
    const springForce = SPRING_FORCE * (1 - morphPulse * 0.35);
    const damping = DAMPING;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      let vx = velocities[ix];
      let vy = velocities[iy];
      let vz = velocities[iz];

      // Spring toward target (weaker near cursor so mouse dominates)
      const dx = targets[ix] - positions[ix];
      const dy = targets[iy] - positions[iy];
      const dz = targets[iz] - positions[iz];

      // Mouse influence
      const pdx = positions[ix] - mx;
      const pdy = positions[iy] - my;
      const pdz = positions[iz] * 0.55;
      const mouseDist = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz) + 0.001;
      const invDist = 1 / mouseDist;
      const nx = pdx * invDist;
      const ny = pdy * invDist;
      const nz = pdz * invDist;

      let mouseMask = 0;
      if (mouseDist < dynamicRadius) {
        const tInfluence = 1 - mouseDist / dynamicRadius;
        // Smooth falloff cubed for soft center + long tail
        const influence = tInfluence * tInfluence * (3 - 2 * tInfluence);
        mouseMask = influence;
        const forceMag = influence * influence * MOUSE_FORCE;
        const speedBoost = 1 + Math.min(mouseSpeed * 0.12, 1.4);

        // Orbit (swirl) around cursor — 3D corkscrew
        const tangentX = -ny;
        const tangentY = nx;
        const orbit = forceMag * MOUSE_ORBIT * speedBoost * 0.12;
        vx += tangentX * orbit * dt;
        vy += tangentY * orbit * dt;
        vz += (nx * 0.35 - nz * 0.2) * orbit * dt * 0.45;

        // Repel / bend away from cursor
        const repulsion = forceMag * MOUSE_REPULSE * 0.14 * speedBoost;
        vx += nx * repulsion * dt;
        vy += ny * repulsion * dt;
        vz += nz * repulsion * dt * 0.75;

        // Drag / suck toward cursor path (viscous bend)
        const pull = influence * 3.2 * dt;
        vx += (mx * 0.08 - positions[ix] * 0.02) * pull;
        vy += (my * 0.08 - positions[iy] * 0.02) * pull;

        // Cursor velocity imparts acceleration + shear distort
        vx += m.vx * viewport.width * 0.08 * influence * dt * 9;
        vy += m.vy * viewport.height * 0.08 * influence * dt * 9;
        vz += (m.vx - m.vy) * 0.15 * influence * dt;

        // Stretch size near cursor with motion
        sizes[i] = Math.min(
          sizes[i] + influence * dt * (3.8 + mouseSpeed * 0.35),
          4.2,
        );

        localEnergy += influence;
      }

      // Formation spring — reduced by mouse mask so cursor wins nearby
      const springScale = 1 - mouseMask * 0.82;
      vx += dx * springForce * springScale * dt;
      vy += dy * springForce * springScale * dt;
      vz += dz * springForce * springScale * dt;

      // Shockwave forces — expanding compressible rings
      for (const wave of sw) {
        const wdx = positions[ix] - wave.x;
        const wdy = positions[iy] - wave.y;
        const wdz = positions[iz] - wave.z;
        const wDist = Math.sqrt(wdx * wdx + wdy * wdy + wdz * wdz) + 0.001;
        const ringProgress = easeOutExpo(wave.age / SHOCKWAVE_LIFE);
        const waveRadius = ringProgress * 7.2 * wave.strength;
        const waveWidth = 0.55 + ringProgress * 0.85;
        const ringDist = Math.abs(wDist - waveRadius);

        if (ringDist < waveWidth) {
          const life = 1 - wave.age / SHOCKWAVE_LIFE;
          const force =
            (1 - ringDist / waveWidth) *
            life *
            SHOCKWAVE_FORCE *
            wave.strength;
          const invWDist = 1 / wDist;
          vx += wdx * invWDist * force * dt;
          vy += wdy * invWDist * force * dt;
          vz += wdz * invWDist * force * dt * 0.55;
          sizes[i] = Math.min(sizes[i] + force * dt * 0.45, 4.8);
          // Tangential swirl on the ring for organic deformation
          vx += -wdy * invWDist * force * dt * 0.35;
          vy += wdx * invWDist * force * dt * 0.35;
        }
      }

      // Damping (lighter near mouse so motion lingers)
      const damp = damping * (1 - mouseMask * 0.45);
      vx -= vx * damp * dt;
      vy -= vy * damp * dt;
      vz -= vz * damp * dt;

      // Organic micro-turbulence (distortion field)
      const turb = fbm(
        positions[ix] * 2.4 + time * 0.9,
        positions[iy] * 2.4 + time * 0.7,
        positions[iz] * 2.4 + time * 0.8 + mouseMask,
        2,
      );
      const turbAmp = (0.55 + mouseMask * 1.8) * dt;
      vx += (turb - 0.5) * turbAmp;
      vy += (turb - 0.5) * turbAmp * 1.1;
      vz += (noise3D(positions[iz] * 2, time, i * 0.01) - 0.5) * turbAmp;

      // Integrate
      positions[ix] += vx * dt;
      positions[iy] += vy * dt;
      positions[iz] += vz * dt;
      velocities[ix] = vx;
      velocities[iy] = vy;
      velocities[iz] = vz;

      // Speed attribute for GPU motion-blur stretch
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      speeds[i] = speed;
      localEnergy += Math.min(speed * 0.04, 0.02);

      // Decay size back toward base
      sizes[i] += (1.0 - sizes[i]) * dt * 1.7;
    }

    // Track global energy for camera/bloom response
    energyRef.current +=
      (localEnergy / PARTICLE_COUNT - energyRef.current) * Math.min(dt * 4, 1);
    energyRef.current *= 1 - dt * 0.35;

    // Subtle camera parallax on pointer + energy punch
    const cam = state.camera;
    const wobble = cameraWobbleRef.current;
    const targetCamX = m.x * 0.55 + Math.sin(time * 0.15) * 0.05;
    const targetCamY = m.y * 0.4 + Math.cos(time * 0.12) * 0.04;
    const targetCamZ = 8.5 + energyRef.current * 0.35;
    const camEase = 1 - Math.exp(-4.5 * dt);
    wobble.x += (targetCamX - wobble.x) * camEase;
    wobble.y += (targetCamY - wobble.y) * camEase;
    wobble.z += (targetCamZ - wobble.z) * camEase;
    cam.position.x = wobble.x;
    cam.position.y = wobble.y;
    cam.position.z = wobble.z;
    cam.lookAt(m.x * 0.15, m.y * 0.1, 0);

    // Dynamic chromatic intensity from motion energy (still subtle monochrome split)
    const ca = 0.0014 + Math.min(mouseSpeed * 0.00035 + energyRef.current * 0.0012, 0.0045);
    caOffset.set(ca * 1.15, ca * 0.85);

    // Upload to GPU
    const posAttr = pointsRef.current.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    posAttr.needsUpdate = true;

    const sizeAttr = pointsRef.current.geometry.getAttribute(
      "aSize",
    ) as THREE.BufferAttribute;
    sizeAttr.needsUpdate = true;

    const speedAttr = pointsRef.current.geometry.getAttribute(
      "aSpeed",
    ) as THREE.BufferAttribute;
    speedAttr.needsUpdate = true;
  });

  return (
    <>
      <points
        ref={pointsRef}
        geometry={geometry}
        material={materialRef.current}
      />
      <EffectComposer multisampling={0}>
        <ChromaticAberration
          offset={caOffset}
          radialModulation
          modulationOffset={0.35}
        />
        <Bloom
          luminanceThreshold={0.08}
          luminanceSmoothing={0.85}
          intensity={0.72}
          mipmapBlur
        />
        <Vignette darkness={0.55} offset={0.18} />
      </EffectComposer>
    </>
  );
}

// ─── hero wrapper ──────────────────────────────────────────

export function CuriosityHero() {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <section
      className="hero-section default-home-hero curiosity-hero-section"
      data-builder-component="HomeHero"
      data-builder-id="home-hero-section"
    >
      <div className="curiosity-hero-canvas">
        {!reducedMotion && (
          <Canvas
            camera={{ position: [0, 0, 8.5], fov: 52, near: 0.1, far: 50 }}
            dpr={[1, 2]}
            gl={{
              antialias: false,
              alpha: false,
              powerPreference: "high-performance",
            }}
            style={{ background: "#000000" }}
          >
            <CuriosityScene />
          </Canvas>
        )}
        {reducedMotion && (
          <div className="curiosity-hero-static" aria-hidden="true" />
        )}
      </div>
      <div className="curiosity-hero-overlay">
        <h1 className="curiosity-hero-headline">Provoke curiosity.</h1>
      </div>
    </section>
  );
}
