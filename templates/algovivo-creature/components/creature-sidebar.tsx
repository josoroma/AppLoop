'use client'

import { useCallback, useState } from 'react'

import {
  AlgovivoCreatureScene,
  type CreatureRuntimeInfo,
} from './algovivo-creature-scene'
import { creatureMeta } from '../lib/creature-mesh'

const INITIAL_INFO: CreatureRuntimeInfo = {
  status: 'booting',
  driver: 'none',
  errorMessage: null,
  numVertices: creatureMeta.num_vertices,
  numTriangles: creatureMeta.num_triangles,
  numMuscles: creatureMeta.num_muscles,
}

export const CreatureSidebar = () => {
  const [info, setInfo] = useState<CreatureRuntimeInfo>(INITIAL_INFO)

  const handleRuntimeInfo = useCallback((next: CreatureRuntimeInfo) => {
    setInfo(next)
  }, [])

  const driverLabel =
    info.driver === 'policy'
      ? ' + MLP policy'
      : info.driver === 'scripted'
        ? ' + scripted gait'
        : ''

  return (
    <>
      <aside
        className="algovivo-copy creature-hero-copy"
        data-builder-component="CreatureSidebar"
        data-builder-id="algovivo-creature-copy"
      >
        <p className="algovivo-eyebrow creature-hero-eyebrow">2D side-view · neural walker cat</p>
        <h1 className="algovivo-title creature-hero-title">Yellow cat that walks forward on a trained policy.</h1>
        <p className="algovivo-summary creature-hero-summary">
          A soft-body cat with pointy ears and a swaying tail, driven by algovivo&apos;s pretrained MLP
          walking policy. Blue neon edges outline the body; red straps glow across muscles as it strides
          forward. Drag it around — it gets back up and keeps walking.
        </p>
        <ul className="algovivo-bullets creature-feature-list" data-builder-id="algovivo-creature-features">
          <li className="algovivo-bullet creature-feature-mesh">yellow body + blue neon edges</li>
          <li className="algovivo-bullet creature-feature-muscles">neural walking policy + scripted tail sway</li>
          <li className="algovivo-bullet creature-feature-gait">real forward locomotion, drag-and-drop enabled</li>
        </ul>

        <div className="algovivo-hud creature-sidebar-hud" data-builder-id="algovivo-creature-hud">
          <p className="algovivo-kicker creature-hud-kicker">algovivo · neural walker cat</p>
          <h2 className="algovivo-hud-title creature-hud-title">Neural walker cat</h2>
          <p className="algovivo-hud-copy creature-hud-copy">
            Pretrained MLP policy drives the quadruped muscles each tick via
            <code className="algovivo-code creature-hud-code"> system.a.set([...])</code>
            {driverLabel}.
          </p>
          <dl className="algovivo-stats creature-stats-grid" data-builder-id="algovivo-creature-stats">
            <div className="algovivo-stat creature-stat-vertices">
              <dt className="algovivo-stat-label creature-stat-vertices-label">Vertices</dt>
              <dd className="algovivo-stat-value creature-stat-vertices-value">{info.numVertices}</dd>
            </div>
            <div className="algovivo-stat creature-stat-triangles">
              <dt className="algovivo-stat-label creature-stat-triangles-label">Triangles</dt>
              <dd className="algovivo-stat-value creature-stat-triangles-value">{info.numTriangles}</dd>
            </div>
            <div className="algovivo-stat creature-stat-muscles">
              <dt className="algovivo-stat-label creature-stat-muscles-label">Muscles</dt>
              <dd className="algovivo-stat-value creature-stat-muscles-value">{info.numMuscles}</dd>
            </div>
            <div className="algovivo-stat creature-stat-status">
              <dt className="algovivo-stat-label creature-stat-status-label">State</dt>
              <dd className="algovivo-stat-value creature-stat-status-value">{info.status}</dd>
            </div>
          </dl>
          {info.errorMessage ? (
            <p className="algovivo-error creature-error-message" role="alert">
              {info.errorMessage}
            </p>
          ) : null}
          <p className="algovivo-legend creature-legend-row" data-builder-id="algovivo-creature-legend">
            <span className="legend-swatch legend-joint">blue neon edges</span>
            <span className="legend-swatch legend-edge">yellow body</span>
            <span className="legend-swatch legend-muscle">red strap muscles</span>
          </p>
        </div>
      </aside>

      <section
        className="algovivo-stage-region creature-stage-region"
        data-builder-id="algovivo-creature-stage-region"
        aria-label="Live soft-body simulation"
      >
        <AlgovivoCreatureScene onRuntimeInfoChange={handleRuntimeInfo} />
      </section>
    </>
  )
}
