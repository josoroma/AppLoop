'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

const LINE_COUNT = 220
const POINTS_PER_LINE = 220
const FIELD_HALF = 1.05
const LINE_SPAN = FIELD_HALF * 2

type PointerStore = {
  target: THREE.Vector2
  current: THREE.Vector2
  prev: THREE.Vector2
  strength: number
  velocity: number
}

function createPointerStore(): PointerStore {
  return {
    target: new THREE.Vector2(0, 0),
    current: new THREE.Vector2(0, 0),
    prev: new THREE.Vector2(0, 0),
    strength: 0,
    velocity: 0,
  }
}

const vertexShader = /* glsl */ `
  attribute float aLineIndex;
  attribute float aPointIndex;
  attribute float aColorMix;

  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uPointerStrength;
  uniform float uPointerVelocity;
  uniform float uLineCount;
  uniform float uPointsPerLine;
  uniform float uBreath;

  varying float vColorMix;
  varying float vLift;
  varying float vDistToPointer;
  varying float vEdge;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.55;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) {
      v += a * snoise(p);
      p.xy = m * p.xy;
      p *= 1.9;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float lineT = aLineIndex / max(uLineCount - 1.0, 1.0);
    float pointT = aPointIndex / max(uPointsPerLine - 1.0, 1.0);

    float x = mix(-1.05, 1.05, pointT);
    float yBase = mix(-1.05, 1.05, lineT);

    vec3 nP = vec3(x * 0.95, yBase * 1.35, uTime * 0.085);
    float n = fbm(nP);
    float n2 = fbm(nP * 1.7 + vec3(2.1, -1.4, uTime * 0.04));
    float fold = abs(snoise(vec3(x * 0.55, yBase * 2.4, uTime * 0.06)));
    float pinch = pow(abs(snoise(vec3(x * 0.35 + 4.0, yBase * 0.8, 1.7))), 2.4);

    float breath = sin(uTime * 0.55 + yBase * 2.3 + x * 0.4) * 0.035 * uBreath;
    float waveY = n * 0.28 + n2 * 0.12 + fold * 0.08 + pinch * 0.06 + breath;
    float waveZ = n * 0.18 + n2 * 0.22 - fold * 0.05;

    vec2 pointer = uPointer;
    float dx = x - pointer.x;
    float dy = (yBase + waveY) - pointer.y;
    float dist = sqrt(dx * dx + dy * dy * 1.35);
    float falloff = exp(-dist * dist * 3.4) * uPointerStrength;
    float ripple = sin(dist * 18.0 - uTime * 9.0) * exp(-dist * 3.2) * uPointerVelocity;

    float attract = falloff * 0.22;
    float lift = falloff * (0.34 + uPointerVelocity * 0.45) + ripple * 0.08;
    float twist = falloff * (0.18 + uPointerVelocity * 0.5);

    x += -dx * attract + (-dy) * twist * 0.55;
    float y = yBase + waveY + lift + (-dy) * attract * 0.35;
    float z = waveZ + falloff * 0.42 + ripple * 0.12;

    float edgeX = smoothstep(0.0, 0.08, pointT) * smoothstep(0.0, 0.08, 1.0 - pointT);
    float edgeY = smoothstep(0.0, 0.05, lineT) * smoothstep(0.0, 0.05, 1.0 - lineT);
    vEdge = edgeX * edgeY;

    vColorMix = aColorMix + n * 0.08 + falloff * 0.12;
    vLift = clamp(lift * 2.2 + falloff, 0.0, 1.5);
    vDistToPointer = dist;

    vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  varying float vColorMix;
  varying float vLift;
  varying float vDistToPointer;
  varying float vEdge;

  vec3 neonRamp(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.15, 0.95, 1.0);
    vec3 c1 = vec3(1.0, 0.18, 0.72);
    vec3 c2 = vec3(0.62, 0.28, 1.0);
    vec3 c3 = vec3(1.0, 0.42, 0.28);
    vec3 c4 = vec3(1.0, 0.78, 0.22);

    if (t < 0.22) return mix(c0, c1, t / 0.22);
    if (t < 0.45) return mix(c1, c2, (t - 0.22) / 0.23);
    if (t < 0.68) return mix(c2, c3, (t - 0.45) / 0.23);
    return mix(c3, c4, (t - 0.68) / 0.32);
  }

  void main() {
    vec3 col = neonRamp(vColorMix);
    col.r += vLift * 0.18;
    col.b += (1.0 - vLift) * 0.05;
    col += vec3(0.08, 0.12, 0.2) * exp(-vDistToPointer * 4.0);

    float alpha = 0.72 + vLift * 0.35;
    alpha *= mix(0.25, 1.0, vEdge);
    alpha = clamp(alpha, 0.0, 1.0);
    col *= 0.85 + vLift * 0.55;

    gl_FragColor = vec4(col, alpha);
  }
`

const grainShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uAmount: { value: 0.045 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float n = hash(vUv * vec2(1920.0, 1080.0) + uTime * 60.0);
      color.rgb += (n - 0.5) * uAmount;
      float d = distance(vUv, vec2(0.5));
      color.rgb *= smoothstep(0.95, 0.28, d);
      color.rgb = mix(color.rgb, color.rgb * vec3(0.85, 0.7, 1.05), 0.12);
      gl_FragColor = color;
    }
  `,
}

function NeonRibbonField({ pointerRef }: { pointerRef: React.MutableRefObject<PointerStore> }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const groupRef = useRef<THREE.Group>(null)

  const geometry = useMemo(() => {
    const total = LINE_COUNT * POINTS_PER_LINE
    const positions = new Float32Array(total * 3)
    const lineIndex = new Float32Array(total)
    const pointIndex = new Float32Array(total)
    const colorMix = new Float32Array(total)
    const indices: number[] = []

    let ptr = 0
    for (let li = 0; li < LINE_COUNT; li += 1) {
      const y = (li / (LINE_COUNT - 1)) * LINE_SPAN - FIELD_HALF
      const mixBase = li / (LINE_COUNT - 1)
      const wobble = Math.sin(li * 0.37) * 0.035
      for (let pi = 0; pi < POINTS_PER_LINE; pi += 1) {
        const x = (pi / (POINTS_PER_LINE - 1)) * LINE_SPAN - FIELD_HALF
        positions[ptr * 3] = x
        positions[ptr * 3 + 1] = y
        positions[ptr * 3 + 2] = 0
        lineIndex[ptr] = li
        pointIndex[ptr] = pi
        colorMix[ptr] = THREE.MathUtils.clamp(mixBase + wobble + (pi / POINTS_PER_LINE - 0.5) * 0.04, 0, 1)
        if (pi < POINTS_PER_LINE - 1) indices.push(ptr, ptr + 1)
        ptr += 1
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aLineIndex', new THREE.BufferAttribute(lineIndex, 1))
    geo.setAttribute('aPointIndex', new THREE.BufferAttribute(pointIndex, 1))
    geo.setAttribute('aColorMix', new THREE.BufferAttribute(colorMix, 1))
    geo.setIndex(indices)
    return geo
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uPointerStrength: { value: 0 },
      uPointerVelocity: { value: 0 },
      uLineCount: { value: LINE_COUNT },
      uPointsPerLine: { value: POINTS_PER_LINE },
      uBreath: { value: 1 },
    }),
    [],
  )

  useFrame((state, delta) => {
    const mat = materialRef.current
    if (!mat) return
    const pointer = pointerRef.current
    const dt = Math.min(delta, 0.05)

    pointer.current.lerp(pointer.target, 1 - Math.exp(-dt * 7.5))
    const dist = pointer.current.distanceTo(pointer.prev)
    const instVel = dist / Math.max(dt, 1e-4)
    pointer.velocity += (Math.min(instVel, 4.5) - pointer.velocity) * (1 - Math.exp(-dt * 6))
    pointer.prev.copy(pointer.current)

    mat.uniforms.uPointerStrength.value +=
      (pointer.strength - mat.uniforms.uPointerStrength.value) * (1 - Math.exp(-dt * 5))
    mat.uniforms.uTime.value = state.clock.elapsedTime
    mat.uniforms.uPointer.value.copy(pointer.current)
    mat.uniforms.uPointerVelocity.value = pointer.velocity * 0.35
    mat.uniforms.uBreath.value = 0.85 + Math.sin(state.clock.elapsedTime * 0.5) * 0.15

    if (groupRef.current) {
      groupRef.current.rotation.x = pointer.current.y * 0.07
      groupRef.current.rotation.y = pointer.current.x * 0.09
      groupRef.current.position.z = Math.sin(state.clock.elapsedTime * 0.22) * 0.03
    }
  })

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <group ref={groupRef}>
      <lineSegments geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  )
}

function PostFX() {
  const { gl, scene, camera, size } = useThree()
  const composerRef = useRef<EffectComposer | null>(null)
  const bloomRef = useRef<UnrealBloomPass | null>(null)
  const grainRef = useRef<ShaderPass | null>(null)

  useEffect(() => {
    const composer = new EffectComposer(gl)
    composer.setSize(size.width, size.height)
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    composer.addPass(new RenderPass(scene, camera))

    const bloom = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.85, 0.7, 0.18)
    bloomRef.current = bloom
    composer.addPass(bloom)

    const grain = new ShaderPass(grainShader)
    grainRef.current = grain
    composer.addPass(grain)

    composerRef.current = composer
    return () => {
      composer.dispose()
      composerRef.current = null
    }
  }, [camera, gl, scene, size.height, size.width])

  useEffect(() => {
    composerRef.current?.setSize(size.width, size.height)
    bloomRef.current?.resolution.set(size.width, size.height)
  }, [size])

  useFrame((state) => {
    if (grainRef.current) grainRef.current.uniforms.uTime.value = state.clock.elapsedTime
    composerRef.current?.render()
  }, 1)

  return null
}

function CameraRig({ pointerRef }: { pointerRef: React.MutableRefObject<PointerStore> }) {
  useFrame((state) => {
    const cam = state.camera
    const t = state.clock.elapsedTime
    const pointer = pointerRef.current
    const orbitX = Math.sin(t * 0.12) * 0.08
    const orbitY = Math.cos(t * 0.09) * 0.05
    const parallaxX = pointer.current.x * 0.14
    const parallaxY = pointer.current.y * 0.1
    cam.position.x += (orbitX + parallaxX - cam.position.x) * 0.04
    cam.position.y += (orbitY + parallaxY - cam.position.y) * 0.04
    cam.position.z += (3.15 - cam.position.z) * 0.04
    cam.lookAt(0, 0, 0)
  })
  return null
}

function SceneContent({ pointerRef }: { pointerRef: React.MutableRefObject<PointerStore> }) {
  return (
    <>
      <color attach="background" args={['#12061f']} />
      <fog attach="fog" args={['#12061f', 2.8, 7.5]} />
      <ambientLight intensity={0.35} />
      <NeonRibbonField pointerRef={pointerRef} />
      <CameraRig pointerRef={pointerRef} />
      <PostFX />
    </>
  )
}

export function NeonFieldScene() {
  const pointerRef = useRef<PointerStore>(createPointerStore())

  const projectPointer = (event: {
    clientX: number
    clientY: number
    currentTarget: EventTarget & HTMLElement
  }) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
    pointerRef.current.target.set(nx * 1.05, ny * 1.05)
  }

  return (
    <div
      className="neon-field-stage immersive-full-screen-stage"
      data-builder-id="neon-field-stage"
      data-builder-component="NeonFieldStage"
      onPointerMove={(event) => {
        projectPointer(event)
        pointerRef.current.strength = 1
      }}
      onPointerDown={(event) => {
        projectPointer(event)
        pointerRef.current.strength = 1.25
        pointerRef.current.velocity = Math.max(pointerRef.current.velocity, 1.1)
      }}
      onPointerLeave={() => {
        pointerRef.current.strength = 0
      }}
      onPointerUp={() => {
        pointerRef.current.strength = 0.55
      }}
    >
      <div className="neon-field-void immersive-void-backdrop" data-builder-id="neon-field-void" aria-hidden />
      <div className="neon-field-frame immersive-square-frame" data-builder-id="neon-field-frame">
        <Canvas
          className="neon-field-canvas immersive-full-screen-canvas"
          data-builder-id="neon-field-canvas"
          data-builder-component="NeonFieldCanvas"
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.15,
          }}
          camera={{ position: [0, 0, 3.15], fov: 38, near: 0.1, far: 20 }}
          onCreated={({ gl }) => {
            gl.setClearColor(new THREE.Color('#12061f'), 1)
          }}
        >
          <SceneContent pointerRef={pointerRef} />
        </Canvas>
        <div className="neon-field-haze immersive-atmosphere-haze" data-builder-id="neon-field-haze" aria-hidden />
      </div>
    </div>
  )
}
