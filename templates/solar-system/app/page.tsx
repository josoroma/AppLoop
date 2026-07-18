"use client";

import { useCallback, useState } from "react";
import { Play, Pause, RotateCcw, ZoomIn, Globe, ExternalLink, ChevronDown, Loader2 } from "lucide-react";
import { CanvasScene } from "../components/canvas-scene";
import type { PlanetInfo } from "../components/solar-system-scene";

function ControlsOverlay({ paused, setPaused, speed, setSpeed, onReset, showLabels, setShowLabels, showOrbits, setShowOrbits, showGrid, setShowGrid }: {
  paused: boolean;
  setPaused: (v: boolean) => void;
  speed: number;
  setSpeed: (v: number) => void;
  onReset: () => void;
  showLabels: boolean;
  setShowLabels: (v: boolean) => void;
  showOrbits: boolean;
  setShowOrbits: (v: boolean) => void;
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
}) {
  return (
    <div className="solar-controls solar-controls-panel" data-builder-component="SolarControls" data-builder-id="solar-controls">
      <button className="solar-control-btn solar-pause-btn" onClick={() => setPaused(!paused)} title={paused ? "Resume" : "Pause"} type="button">
        {paused ? <Play className="size-4 solar-pause-icon" /> : <Pause className="size-4 solar-pause-icon" />}
      </button>
      <div className="solar-speed-group" data-builder-id="solar-speed-group">
        <button className="solar-control-btn solar-speed-down-btn" disabled={speed <= 0.25} onClick={() => setSpeed(Math.max(0.25, speed - 0.25))} type="button">−</button>
        <span className="solar-speed-label">{speed}x</span>
        <button className="solar-control-btn solar-speed-up-btn" disabled={speed >= 3} onClick={() => setSpeed(Math.min(3, speed + 0.25))} type="button">+</button>
      </div>
      <button className="solar-control-btn solar-reset-btn" onClick={onReset} title="Reset view" type="button"><RotateCcw className="size-4 solar-reset-icon" /></button>
      <div className="solar-divider" />
      <label className="solar-toggle solar-labels-toggle"><input checked={showLabels} className="solar-toggle-checkbox solar-labels-checkbox" onChange={(e) => setShowLabels(e.target.checked)} type="checkbox" /><span className="solar-toggle-label solar-labels-toggle-label">Labels</span></label>
      <label className="solar-toggle solar-orbits-toggle"><input checked={showOrbits} className="solar-toggle-checkbox solar-orbits-checkbox" onChange={(e) => setShowOrbits(e.target.checked)} type="checkbox" /><span className="solar-toggle-label solar-orbits-toggle-label">Orbits</span></label>
      <label className="solar-toggle solar-grid-toggle"><input checked={showGrid} className="solar-toggle-checkbox solar-grid-checkbox" onChange={(e) => setShowGrid(e.target.checked)} type="checkbox" /><span className="solar-toggle-label solar-grid-toggle-label">Grid</span></label>
    </div>
  );
}

function LoadingOverlay({ progress }: { progress: number }) {
  if (progress >= 100) return null;

  return (
    <div className="solar-loading-overlay" data-builder-id="solar-loading-overlay">
      <div className="solar-loading-card solar-ui-panel">
        <Loader2 className="size-10 animate-spin text-primary solar-loading-spinner" />
        <h2 className="solar-loading-title">Entering the Space-Time Continuum</h2>
        <div className="solar-loading-bar-track"><div className="solar-loading-bar-fill" style={{ width: `${progress}%` }} /></div>
        <p className="solar-loading-text">{Math.round(progress)}% — rendering solar system</p>
      </div>
    </div>
  );
}

function PlanetInfoCard({ planet, onClose }: { planet: PlanetInfo | null; onClose: () => void }) {
  if (!planet) return null;

  return (
    <div className="solar-planet-card solar-planet-info-panel" data-builder-component="PlanetInfoCard" data-builder-id="solar-planet-card">
      <button className="solar-planet-card-close" onClick={onClose} type="button"><ChevronDown className="size-5" /></button>
      <div className="solar-planet-card-image" style={{ background: `radial-gradient(circle at 30% 30%, ${planet.color}88, ${planet.color}33 60%, transparent)` }}>
        <div className="solar-planet-card-orb" style={{ background: `radial-gradient(circle at 35% 35%, white 4%, ${planet.color} 42%, ${planet.color}66 100%)`, boxShadow: `0 0 60px ${planet.color}88` }} />
      </div>
      <h3 className="solar-planet-card-name">{planet.name}</h3>
      <dl className="solar-planet-card-stats">
        <div className="solar-stat solar-stat-diameter"><dt className="solar-stat-label solar-stat-diameter-label">Diameter</dt><dd className="solar-stat-value solar-stat-diameter-value">{planet.diameter}</dd></div>
        <div className="solar-stat solar-stat-distance"><dt className="solar-stat-label solar-stat-distance-label">Distance from Sun</dt><dd className="solar-stat-value solar-stat-distance-value">{planet.distanceFromSun}</dd></div>
        <div className="solar-stat solar-stat-orbit"><dt className="solar-stat-label solar-stat-orbit-label">Orbital period</dt><dd className="solar-stat-value solar-stat-orbit-value">{planet.orbitalPeriod}</dd></div>
      </dl>
      <a className="solar-planet-card-nasa" href={planet.nasaUrl} rel="noopener noreferrer" target="_blank">
        <Globe className="size-4 solar-nasa-globe-icon" />
        Explore on NASA
        <ExternalLink className="size-3" />
      </a>
    </div>
  );
}

export default function Home() {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetInfo | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [started, setStarted] = useState(false);

  const handleReset = useCallback(() => {
    window.dispatchEvent(new CustomEvent("solar-reset"));
  }, []);

  if (!started) {
    return (
      <main className="solar-shell solar-start-shell" data-builder-component="SolarStartPage" data-builder-id="solar-start-page">
        <div className="solar-start-content">
          <h1 className="solar-start-title">Explore the Space-Time Continuum</h1>
          <p className="solar-start-subtitle">Navigate an interactive cinematic 3D Solar System with eight planets, glowing orbital paths, and a dynamic gravitational grid.</p>
          <button className="solar-start-btn" onClick={() => setStarted(true)} type="button">
            <ZoomIn className="size-5" />
            Begin Exploration
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="solar-shell solar-main-shell" data-builder-component="SolarSystemPage" data-builder-id="solar-system-page">
      <CanvasScene
        paused={paused}
        showGrid={showGrid}
        showLabels={showLabels}
        showOrbits={showOrbits}
        speed={speed}
        onSelectPlanet={setSelectedPlanet}
        onProgress={setLoadingProgress}
      />

      <ControlsOverlay
        paused={paused}
        setPaused={setPaused}
        speed={speed}
        setSpeed={setSpeed}
        onReset={handleReset}
        showLabels={showLabels}
        setShowLabels={setShowLabels}
        showOrbits={showOrbits}
        setShowOrbits={setShowOrbits}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
      />

      <PlanetInfoCard planet={selectedPlanet} onClose={() => setSelectedPlanet(null)} />

      <LoadingOverlay progress={loadingProgress} />
    </main>
  );
}
