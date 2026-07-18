/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

export type PlanetInfo = {
  name: string;
  color: string;
  diameter: string;
  distanceFromSun: string;
  orbitalPeriod: string;
  nasaUrl: string;
};

type SolarBody = PlanetInfo & {
  size: number;
  orbitRadius: number;
  speed: number;
  rotSpeed: number;
  startAngle: number;
  inclination: number;
  axialTilt: number;
  roughness: number;
  metalness: number;
  emissive?: string;
  ring?: {
    innerRadius: number;
    outerRadius: number;
    color: string;
  };
};

const SUN_RADIUS = 1.75;
const SUN_INFO: PlanetInfo = {
  name: "Sun",
  color: "#ffd54a",
  diameter: "1,392,700 km",
  distanceFromSun: "Center of the Solar System",
  orbitalPeriod: "25–35 days rotation",
  nasaUrl: "https://science.nasa.gov/sun/",
};

// Distances use a compressed logarithmic visual scale while preserving the real orbital order.
// Planet radii are also compressed; gas giants remain larger than terrestrial planets without overwhelming orbit spacing.
const PLANETS: SolarBody[] = [
  { name: "Mercury", color: "#d8d1c4", size: 0.16, orbitRadius: 4.4, speed: 4.15, rotSpeed: 0.45, startAngle: 0.35, inclination: 7.0, axialTilt: 0.03, roughness: 0.9, metalness: 0.04, emissive: "#4a453c", diameter: "4,879 km", distanceFromSun: "57.9 million km", orbitalPeriod: "88 days", nasaUrl: "https://science.nasa.gov/mercury/" },
  { name: "Venus", color: "#ffd27a", size: 0.32, orbitRadius: 6.2, speed: 3.0, rotSpeed: -0.22, startAngle: 1.15, inclination: 3.4, axialTilt: 177.4, roughness: 0.82, metalness: 0.03, emissive: "#6b4212", diameter: "12,104 km", distanceFromSun: "108.2 million km", orbitalPeriod: "225 days", nasaUrl: "https://science.nasa.gov/venus/" },
  { name: "Earth", color: "#49b8ff", size: 0.34, orbitRadius: 8.4, speed: 2.4, rotSpeed: 0.8, startAngle: 2.35, inclination: 0, axialTilt: 23.4, roughness: 0.55, metalness: 0.02, emissive: "#063a6a", diameter: "12,742 km", distanceFromSun: "149.6 million km", orbitalPeriod: "365 days", nasaUrl: "https://science.nasa.gov/earth/" },
  { name: "Mars", color: "#ff7048", size: 0.22, orbitRadius: 11.1, speed: 1.8, rotSpeed: 0.72, startAngle: 3.4, inclination: 1.85, axialTilt: 25.2, roughness: 0.84, metalness: 0.02, emissive: "#6f1b0b", diameter: "6,779 km", distanceFromSun: "227.9 million km", orbitalPeriod: "687 days", nasaUrl: "https://science.nasa.gov/mars/" },
  { name: "Jupiter", color: "#f3bd73", size: 1.15, orbitRadius: 16.8, speed: 1.0, rotSpeed: 1.28, startAngle: 4.55, inclination: 1.3, axialTilt: 3.1, roughness: 0.74, metalness: 0.01, emissive: "#5c3211", diameter: "139,820 km", distanceFromSun: "778.5 million km", orbitalPeriod: "11.9 years", nasaUrl: "https://science.nasa.gov/jupiter/" },
  { name: "Saturn", color: "#ffe3a4", size: 0.98, orbitRadius: 22.8, speed: 0.72, rotSpeed: 1.08, startAngle: 5.25, inclination: 2.49, axialTilt: 26.7, roughness: 0.78, metalness: 0.01, emissive: "#5a4216", ring: { innerRadius: 1.22, outerRadius: 1.82, color: "#fff0b5" }, diameter: "116,460 km", distanceFromSun: "1.43 billion km", orbitalPeriod: "29.5 years", nasaUrl: "https://science.nasa.gov/saturn/" },
  { name: "Uranus", color: "#8ff4ff", size: 0.58, orbitRadius: 29.2, speed: 0.5, rotSpeed: -0.62, startAngle: 0.9, inclination: 0.77, axialTilt: 97.8, roughness: 0.58, metalness: 0.02, emissive: "#0b5660", diameter: "50,724 km", distanceFromSun: "2.87 billion km", orbitalPeriod: "84 years", nasaUrl: "https://science.nasa.gov/uranus/" },
  { name: "Neptune", color: "#638bff", size: 0.56, orbitRadius: 35.8, speed: 0.38, rotSpeed: 0.66, startAngle: 2.0, inclination: 1.77, axialTilt: 28.3, roughness: 0.6, metalness: 0.02, emissive: "#102d7a", diameter: "49,244 km", distanceFromSun: "4.50 billion km", orbitalPeriod: "165 years", nasaUrl: "https://science.nasa.gov/neptune/" },
];

function SunMesh({ showLabel, onSelectPlanet }: { showLabel: boolean; onSelectPlanet: (p: PlanetInfo) => void }) {
  const sunRef = useRef<THREE.Mesh>(null);

  useFrame((_state, delta) => {
    if (sunRef.current) {
      sunRef.current.rotation.y += delta * 0.12;
    }
  });

  const handlePointerOver = () => {
    document.body.style.cursor = "pointer";
  };
  const handlePointerOut = () => {
    document.body.style.cursor = "";
  };

  return (
    <group>
      <mesh ref={sunRef} onClick={() => onSelectPlanet(SUN_INFO)} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        <sphereGeometry args={[SUN_RADIUS, 96, 96]} />
        <meshBasicMaterial color="#ffd347" />
      </mesh>
      <mesh onClick={() => onSelectPlanet(SUN_INFO)} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        <sphereGeometry args={[SUN_RADIUS + 0.18, 32, 32]} />
        <meshBasicMaterial opacity={0} transparent />
      </mesh>
      {showLabel ? (
        <Html center distanceFactor={13} position={[0, SUN_RADIUS + 0.45, 0]} style={{ pointerEvents: "none" }}>
          <span className="solar-planet-label solar-sun-label">Sun</span>
        </Html>
      ) : null}
    </group>
  );
}

function SunGlow() {
  return (
    <>
      <mesh>
        <sphereGeometry args={[SUN_RADIUS + 0.42, 48, 48]} />
        <shaderMaterial
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={`
            varying vec3 vNormal;
            void main() {
              float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
              gl_FragColor = vec4(1.0, 0.55, 0.08, intensity * 0.45);
            }
          `}
          side={THREE.BackSide}
          uniforms={{}}
          vertexShader={`
            varying vec3 vNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[SUN_RADIUS + 1.25, 48, 48]} />
        <shaderMaterial
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={`
            varying vec3 vNormal;
            void main() {
              float intensity = pow(0.76 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.2);
              gl_FragColor = vec4(1.0, 0.35, 0.05, intensity * 0.18);
            }
          `}
          side={THREE.BackSide}
          uniforms={{}}
          vertexShader={`
            varying vec3 vNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
        />
      </mesh>
    </>
  );
}

function SaturnRing({ planet }: { planet: SolarBody }) {
  if (!planet.ring) return null;

  return (
    <mesh rotation={[Math.PI / 2.35, 0, 0]}>
      <ringGeometry args={[planet.size * planet.ring.innerRadius, planet.size * planet.ring.outerRadius, 96]} />
      <meshBasicMaterial color={planet.ring.color} opacity={0.46} side={THREE.DoubleSide} transparent />
    </mesh>
  );
}

function PlanetMesh({ planet, showLabel, speed, onSelectPlanet, planetInfo }: {
  planet: SolarBody;
  showLabel: boolean;
  speed: number;
  onSelectPlanet: (p: PlanetInfo) => void;
  planetInfo: PlanetInfo;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const orbitPivotRef = useRef<THREE.Group>(null);
  const visualRef = useRef<THREE.Mesh>(null);
  const orbitRef = useRef(planet.startAngle);

  useFrame((_state, delta) => {
    orbitRef.current += delta * planet.speed * speed * 0.18;
    const angle = orbitRef.current;
    if (orbitPivotRef.current) {
      orbitPivotRef.current.position.x = Math.cos(angle) * planet.orbitRadius;
      orbitPivotRef.current.position.z = Math.sin(angle) * planet.orbitRadius;
    }
    if (visualRef.current) {
      visualRef.current.rotation.y += delta * planet.rotSpeed * speed * 0.5;
    }
  });

  const handlePointerOver = () => {
    document.body.style.cursor = "pointer";
  };
  const handlePointerOut = () => {
    document.body.style.cursor = "";
  };

  return (
    <group ref={groupRef} rotation={[THREE.MathUtils.degToRad(planet.inclination), 0, 0]}>
      <group ref={orbitPivotRef}>
        <group rotation={[0, 0, THREE.MathUtils.degToRad(planet.axialTilt)]}>
          <mesh ref={visualRef}>
            <sphereGeometry args={[planet.size, 64, 64]} />
            <meshStandardMaterial
              color={planet.color}
              emissive={planet.emissive ?? "#000000"}
              emissiveIntensity={planet.emissive ? 0.16 : 0.02}
              metalness={planet.metalness}
              roughness={planet.roughness}
            />
          </mesh>
          <SaturnRing planet={planet} />
        </group>
        <mesh
          onClick={() => onSelectPlanet(planetInfo)}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <sphereGeometry args={[planet.size + 0.22, 20, 20]} />
          <meshBasicMaterial opacity={0} transparent />
        </mesh>
        {showLabel ? (
          <Html center distanceFactor={13} position={[0, planet.size + 0.42, 0]} style={{ pointerEvents: "none" }}>
            <span className="solar-planet-label">{planet.name}</span>
          </Html>
        ) : null}
      </group>
    </group>
  );
}

function OrbitRing({ radius, inclination }: { radius: number; inclination: number }) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 192; i++) {
      const angle = (i / 192) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    return pts;
  }, [radius]);

  return (
    <line rotation={[THREE.MathUtils.degToRad(inclination), 0, 0]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])), 3]}
          count={points.length}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#245b92" opacity={0.3} transparent />
    </line>
  );
}

function GravitationalGrid({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <mesh position={[0, -2.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[86, 86, 86, 86]} />
      <shaderMaterial
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        fragmentShader={`
          varying vec2 vUv;
          varying vec3 vWorldPos;
          uniform float u_time;
          void main() {
            vec2 grid = abs(fract(vUv * 34.0) - 0.5);
            float line = min(grid.x, grid.y);
            float alpha = smoothstep(0.032, 0.0, line) * 0.22;
            alpha *= smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
            alpha *= smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
            float distance = length(vWorldPos.xz);
            float gravityWell = 1.0 + 0.24 * exp(-distance * 0.12);
            float warp = gravityWell + 0.035 * sin(vWorldPos.x * 0.8 + u_time * 0.2) * cos(vWorldPos.z * 0.8 + u_time * 0.15);
            vec3 color = mix(vec3(0.04, 0.10, 0.26), vec3(0.08, 0.25, 0.55), warp * 0.65);
            gl_FragColor = vec4(color, alpha * warp);
          }
        `}
        uniforms={{
          u_time: { value: 0 },
        }}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            float distance = length(position.xy);
            vec3 displaced = position;
            displaced.z -= 1.15 * exp(-distance * 0.1);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
          }
        `}
      />
    </mesh>
  );
}

const TRAIL_COUNT = 620;
const trailPositions = (() => {
  const arr = new Float32Array(TRAIL_COUNT * 3);
  for (let i = 0; i < TRAIL_COUNT; i++) {
    const radius = 5 + Math.random() * 38;
    const angle = Math.random() * Math.PI * 2;
    arr[i * 3] = Math.cos(angle) * radius;
    arr[i * 3 + 1] = (Math.random() - 0.5) * 1.6;
    arr[i * 3 + 2] = Math.sin(angle) * radius;
  }
  return arr;
})();

function ParticleTrails() {
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[trailPositions, 3]}
          count={TRAIL_COUNT}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#5fa8ff" size={0.045} blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.5} transparent />
    </points>
  );
}

export function SolarSystemScene({ paused, showGrid, showLabels, showOrbits, speed, onSelectPlanet, onProgress }: {
  paused: boolean;
  showGrid: boolean;
  showLabels: boolean;
  showOrbits: boolean;
  speed: number;
  onSelectPlanet: (p: PlanetInfo | null) => void;
  onProgress: (p: number) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const gridMatRef = useRef<THREE.ShaderMaterial | null>(null);

  useEffect(() => {
    const handleReset = () => {
      if (groupRef.current) {
        groupRef.current.rotation.y = 0;
      }
    };
    window.addEventListener("solar-reset", handleReset);
    return () => window.removeEventListener("solar-reset", handleReset);
  }, []);

  useFrame((_state, delta) => {
    if (paused) return;
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.018 * speed;
    }
    if (gridMatRef.current) {
      gridMatRef.current.uniforms.u_time.value += delta * speed;
    }
  });

  useEffect(() => {
    onProgress(100);
  }, [onProgress]);

  return (
    <group ref={groupRef}>
      <SunMesh showLabel={showLabels} onSelectPlanet={onSelectPlanet} />
      <SunGlow />
      <ParticleTrails />

      {showOrbits ? PLANETS.map((p) => <OrbitRing key={`orbit-${p.name}`} radius={p.orbitRadius} inclination={p.inclination} />) : null}

      {showGrid ? <GravitationalGrid show={showGrid} /> : null}

      {PLANETS.map((planet) => (
        <PlanetMesh
          key={planet.name}
          planet={planet}
          showLabel={showLabels}
          speed={speed}
          onSelectPlanet={onSelectPlanet}
          planetInfo={{
            name: planet.name,
            color: planet.color,
            diameter: planet.diameter,
            distanceFromSun: planet.distanceFromSun,
            orbitalPeriod: planet.orbitalPeriod,
            nasaUrl: planet.nasaUrl,
          }}
        />
      ))}
    </group>
  );
}
