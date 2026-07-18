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
      camera={{ position: [0, 18, 28], fov: 50, near: 0.1, far: 200 }}
      className="solar-canvas"
      gl={{ antialias: true, alpha: false }}
      onCreated={() => {
        let p = 0;
        const interval = setInterval(() => { p = Math.min(100, p + Math.random() * 18); onProgress(p); if (p >= 100) clearInterval(interval); }, 200);
      }}
    >
      <color attach="background" args={["#020210"]} />
      <fog attach="fog" args={["#020210", 40, 120]} />
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 0, 0]} intensity={2} distance={60} decay={1.2} color="#fff8e7" />
      <Stars count={2000} depth={80} factor={3} fade radius={80} saturation={0} speed={0.5} />
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
