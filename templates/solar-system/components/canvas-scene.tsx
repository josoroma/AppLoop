/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { SolarSystemScene } from "./solar-system-scene";
import type { PlanetInfo } from "./solar-system-scene";

export function CanvasScene({ paused, showGrid, showLabels, showOrbits, speed, onSelectPlanet, onProgress }: {
  paused: boolean;
  showGrid: boolean;
  showLabels: boolean;
  showOrbits: boolean;
  speed: number;
  onSelectPlanet: (p: PlanetInfo | null) => void;
  onProgress: (p: number) => void;
}) {
  return (
    <Canvas
      camera={{ position: [0, 24, 42], fov: 48, near: 0.1, far: 260 }}
      className="solar-canvas"
      gl={{ antialias: true, alpha: false, toneMappingExposure: 1.05 }}
      onCreated={() => {
        let p = 0;
        const interval = setInterval(() => { p = Math.min(100, p + Math.random() * 18); onProgress(p); if (p >= 100) clearInterval(interval); }, 200);
      }}
    >
      <color attach="background" args={["#020210"]} />
      <fog attach="fog" args={["#020210", 54, 150]} />
      <ambientLight intensity={0.08} />
      <pointLight position={[0, 0, 0]} intensity={4.6} distance={90} decay={1.65} color="#fff3c2" />
      <hemisphereLight args={["#172a66", "#05030b", 0.22]} />
      <Stars count={3200} depth={110} factor={3.4} fade radius={105} saturation={0.2} speed={0.22} />
      <Suspense fallback={null}>
        <SolarSystemScene
          paused={paused}
          showGrid={showGrid}
          showLabels={showLabels}
          showOrbits={showOrbits}
          speed={speed}
          onSelectPlanet={onSelectPlanet}
          onProgress={onProgress}
        />
      </Suspense>
      <OrbitControls
        dampingFactor={0.08}
        enableDamping
        enablePan
        maxDistance={80}
        minDistance={5}
        rotateSpeed={0.6}
        zoomSpeed={1.2}
      />
    </Canvas>
  );
}
