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

const PLANETS: {
  name: string;
  color: string;
  size: number;
  orbitRadius: number;
  speed: number;
  rotSpeed: number;
  startAngle: number;
  diameter: string;
  distanceFromSun: string;
  orbitalPeriod: string;
  nasaUrl: string;
}[] = [
  { name: "Mercury", color: "#b0b0b0", size: 0.38, orbitRadius: 3.5, speed: 4.15, rotSpeed: 0.6, startAngle: Math.random() * Math.PI * 2, diameter: "4,879 km", distanceFromSun: "58 M km", orbitalPeriod: "88 days", nasaUrl: "https://science.nasa.gov/mercury/" },
  { name: "Venus", color: "#e8cda0", size: 0.95, orbitRadius: 5.5, speed: 3.0, rotSpeed: 0.4, startAngle: Math.random() * Math.PI * 2, diameter: "12,104 km", distanceFromSun: "108 M km", orbitalPeriod: "225 days", nasaUrl: "https://science.nasa.gov/venus/" },
  { name: "Earth", color: "#4da6ff", size: 1.0, orbitRadius: 7.5, speed: 2.4, rotSpeed: 0.8, startAngle: Math.random() * Math.PI * 2, diameter: "12,742 km", distanceFromSun: "150 M km", orbitalPeriod: "365 days", nasaUrl: "https://science.nasa.gov/earth/" },
  { name: "Mars", color: "#e0553d", size: 0.53, orbitRadius: 9.8, speed: 1.8, rotSpeed: 0.7, startAngle: Math.random() * Math.PI * 2, diameter: "6,779 km", distanceFromSun: "228 M km", orbitalPeriod: "687 days", nasaUrl: "https://science.nasa.gov/mars/" },
  { name: "Jupiter", color: "#d4a574", size: 3.2, orbitRadius: 14, speed: 1.0, rotSpeed: 1.2, startAngle: Math.random() * Math.PI * 2, diameter: "139,820 km", distanceFromSun: "778 M km", orbitalPeriod: "12 years", nasaUrl: "https://science.nasa.gov/jupiter/" },
  { name: "Saturn", color: "#e8d5a3", size: 2.7, orbitRadius: 18, speed: 0.72, rotSpeed: 1.0, startAngle: Math.random() * Math.PI * 2, diameter: "116,460 km", distanceFromSun: "1.4 B km", orbitalPeriod: "29 years", nasaUrl: "https://science.nasa.gov/saturn/" },
  { name: "Uranus", color: "#7ec8e3", size: 1.8, orbitRadius: 22, speed: 0.5, rotSpeed: 0.9, startAngle: Math.random() * Math.PI * 2, diameter: "50,724 km", distanceFromSun: "2.9 B km", orbitalPeriod: "84 years", nasaUrl: "https://science.nasa.gov/uranus/" },
  { name: "Neptune", color: "#3f54ba", size: 1.7, orbitRadius: 26, speed: 0.38, rotSpeed: 0.85, startAngle: Math.random() * Math.PI * 2, diameter: "49,244 km", distanceFromSun: "4.5 B km", orbitalPeriod: "165 years", nasaUrl: "https://science.nasa.gov/neptune/" },
];

function SunMesh() {
  const sunRef = useRef<THREE.Mesh>(null);

  useFrame((_state, delta) => {
    if (sunRef.current) {
      sunRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <mesh ref={sunRef}>
      <sphereGeometry args={[2.2, 64, 64]} />
      <meshBasicMaterial color="#ffcc00" />
    </mesh>
  );
}

function SunGlow() {
  return (
    <>
      <mesh>
        <sphereGeometry args={[2.6, 32, 32]} />
        <shaderMaterial
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={`
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
              float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
              gl_FragColor = vec4(1.0, 0.65, 0.1, intensity * 0.45);
            }
          `}
          side={THREE.BackSide}
          uniforms={{}}
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vPosition = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[3.2, 32, 32]} />
        <shaderMaterial
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={`
            varying vec3 vNormal;
            void main() {
              float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.5);
              gl_FragColor = vec4(1.0, 0.5, 0.08, intensity * 0.18);
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

function PlanetMesh({ planet, showLabel, speed, onSelectPlanet, planetInfo }: {
  planet: typeof PLANETS[number];
  showLabel: boolean;
  speed: number;
  onSelectPlanet: (p: PlanetInfo) => void;
  planetInfo: PlanetInfo;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const visualRef = useRef<THREE.Mesh>(null);
  const orbitRef = useRef(planet.startAngle);

  useFrame((_state, delta) => {
    orbitRef.current += delta * planet.speed * speed * 0.3;
    const angle = orbitRef.current;
    if (groupRef.current) {
      groupRef.current.position.x = Math.cos(angle) * planet.orbitRadius;
      groupRef.current.position.z = Math.sin(angle) * planet.orbitRadius;
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
    <group ref={groupRef}>
      {/* Visual planet sphere */}
      <mesh ref={visualRef}>
        <sphereGeometry args={[planet.size, 48, 48]} />
        <meshStandardMaterial color={planet.color} metalness={0.1} roughness={0.7} />
      </mesh>
      {/* Larger invisible click target — follows the group position */}
      <mesh
        onClick={() => onSelectPlanet(planetInfo)}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[planet.size + 0.15, 16, 16]} />
        <meshBasicMaterial opacity={0} transparent />
      </mesh>
      {showLabel ? (
        <Html center distanceFactor={12} occlude style={{ pointerEvents: "none" }}>
          <span className="solar-planet-label">{planet.name}</span>
        </Html>
      ) : null}
    </group>
  );
}

function OrbitRing({ radius }: { radius: number }) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    return pts;
  }, [radius]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])), 3]}
          count={points.length}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#1a3a5c" opacity={0.35} transparent />
    </line>
  );
}

function GravitationalGrid({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <mesh position={[0, -3.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[60, 60, 60, 60]} />
      <shaderMaterial
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        fragmentShader={`
          varying vec2 vUv;
          varying vec3 vWorldPos;
          uniform float u_time;
          void main() {
            vec2 grid = abs(fract(vUv * 30.0) - 0.5);
            float line = min(grid.x, grid.y);
            float alpha = smoothstep(0.04, 0.0, line) * 0.25;
            alpha *= smoothstep(0.0, 0.4, vUv.x) * smoothstep(1.0, 0.6, vUv.x);
            alpha *= smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
            float warp = 1.0 + 0.06 * sin(vWorldPos.x * 0.8 + u_time * 0.2) * cos(vWorldPos.z * 0.8 + u_time * 0.15);
            vec3 color = mix(vec3(0.05, 0.12, 0.35), vec3(0.08, 0.2, 0.5), warp * 0.7);
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
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
      />
    </mesh>
  );
}

const TRAIL_COUNT = 400;
const trailPositions = (() => {
  const arr = new Float32Array(TRAIL_COUNT * 3);
  for (let i = 0; i < TRAIL_COUNT; i++) {
    const radius = 4 + Math.random() * 28;
    const angle = Math.random() * Math.PI * 2;
    arr[i * 3] = Math.cos(angle) * radius;
    arr[i * 3 + 1] = (Math.random() - 0.5) * 1.2;
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
      <pointsMaterial color="#4488ff" size={0.06} blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.6} transparent />
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
      groupRef.current.rotation.y += delta * 0.04 * speed;
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
      <SunMesh />
      <SunGlow />
      <ParticleTrails />

      {showOrbits ? PLANETS.map((p) => <OrbitRing key={`orbit-${p.name}`} radius={p.orbitRadius} />) : null}

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
