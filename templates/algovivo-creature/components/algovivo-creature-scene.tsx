'use client'

import { useEffect, useRef, useState } from 'react'

import type {
  AlgovivoModule,
  AlgovivoPolicy,
  AlgovivoSystem,
  AlgovivoViewport,
} from '../lib/algovivo-types'
import {
  creatureMesh,
  creatureMeta,
  POLICY_MUSCLE_COUNT,
  POLICY_VERTEX_COUNT,
} from '../lib/creature-mesh'
import { applyTailSway } from '../lib/gait'

const WASM_URL = '/vendor/algovivo/algovivo.wasm'
const MODULE_URL = '/vendor/algovivo/algovivo.min.js'
const POLICY_URL = '/data/quadruped/policy.json'

// Official demo runs ~30hz — normal speed.
const SIM_HZ = 30
const SIM_DT_MS = 1000 / SIM_HZ

// Official quadruped body + ears/tail; wider frame keeps the stride visible.
const VISIBLE_WORLD_WIDTH = 6.4

async function loadWasmInstance() {
  const response = await fetch(WASM_URL)
  if (!response.ok) {
    throw new Error(`Failed to load algovivo wasm (${response.status})`)
  }

  try {
    const streaming = await WebAssembly.instantiateStreaming(response.clone())
    return streaming.instance
  } catch {
    const buffer = await response.arrayBuffer()
    const compiled = await WebAssembly.instantiate(buffer)
    return compiled.instance
  }
}

async function loadAlgovivoModule(): Promise<AlgovivoModule> {
  const href = new URL(MODULE_URL, window.location.origin).href
  const mod = await import(/* webpackIgnore: true */ href)
  return mod as AlgovivoModule
}

async function loadPolicyData(): Promise<unknown> {
  const response = await fetch(POLICY_URL)
  if (!response.ok) {
    throw new Error(`Failed to load walking policy (${response.status})`)
  }
  return response.json()
}

export type CreatureRuntimeInfo = {
  status: 'booting' | 'walking' | 'error'
  driver: 'policy' | 'scripted' | 'none'
  errorMessage: string | null
  numVertices: number
  numTriangles: number
  numMuscles: number
}

type AlgovivoCreatureSceneProps = {
  onRuntimeInfoChange?: (info: CreatureRuntimeInfo) => void
}

export const AlgovivoCreatureScene = ({ onRuntimeInfoChange }: AlgovivoCreatureSceneProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const onInfoRef = useRef(onRuntimeInfoChange)
  const [status, setStatus] = useState<'booting' | 'walking' | 'error'>('booting')
  const [driver, setDriver] = useState<'policy' | 'scripted' | 'none'>('none')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    onInfoRef.current = onRuntimeInfoChange
  }, [onRuntimeInfoChange])

  useEffect(() => {
    onInfoRef.current?.({
      status,
      driver,
      errorMessage,
      numVertices: creatureMeta.num_vertices,
      numTriangles: creatureMeta.num_triangles,
      numMuscles: creatureMeta.num_muscles,
    })
  }, [status, driver, errorMessage])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let frameId = 0
    let system: AlgovivoSystem | null = null
    let viewport: AlgovivoViewport | null = null
    let policy: AlgovivoPolicy | null = null
    let startedAt = 0
    let lastSimAt = 0
    let simTimeSeconds = 0

    const resize = () => {
      if (!host || !viewport) return
      const rect = host.getBoundingClientRect()
      const width = Math.max(360, Math.floor(rect.width))
      const height = Math.max(360, Math.floor(rect.height))
      viewport.setSize({ width, height })
      viewport.render()
    }

    const loop = (now: number) => {
      if (disposed || !system || !viewport) return
      if (!startedAt) {
        startedAt = now
        lastSimAt = now
      }

      try {
        let steps = 0
        while (now - lastSimAt >= SIM_DT_MS && steps < 2) {
          lastSimAt += SIM_DT_MS
          simTimeSeconds += SIM_DT_MS / 1000
          steps += 1
          // Pretrained MLP policy writes the quadruped muscles [0..38).
          policy?.step()
          // Scripted layer: sway only the appended cat-tail muscles.
          const activations = system.a.toArray?.() as number[] | undefined
          if (activations) {
            system.a.set(applyTailSway(activations, simTimeSeconds))
          }
          system.step()
        }

        if (steps > 0) {
          viewport.render()
        }
      } catch (error) {
        if (!disposed) {
          const message = error instanceof Error ? error.message : 'Simulation step failed'
          setErrorMessage(message)
          setStatus('error')
        }
        return
      }

      frameId = window.requestAnimationFrame(loop)
    }

    const boot = async () => {
      try {
        const [algovivo, wasmInstance, policyData] = await Promise.all([
          loadAlgovivoModule(),
          loadWasmInstance(),
          loadPolicyData(),
        ])
        if (disposed) return

        const SystemViewport = algovivo.SystemViewport ?? algovivo.render?.SystemViewport
        if (!SystemViewport) {
          throw new Error('algovivo SystemViewport export missing')
        }

        system = new algovivo.System({ wasmInstance })
        // Default algovivo timestep (normal elasticity).
        system.h = 0.033
        system.set({
          pos: creatureMesh.pos.map((pair) => [...pair]),
          triangles: creatureMesh.triangles.map((tri) => [...tri]),
          muscles: creatureMesh.muscles.map((edge) => [...edge]),
          l0: [...creatureMesh.l0],
          rsi: creatureMesh.rsi.map((cell) => cell.map((row) => [...row])),
        })

        // The trained walking policy sees the original quadruped sub-view
        // (62 verts / 38 muscles); ears + tail live beyond those indices.
        if (algovivo.nn?.MLPPolicy) {
          policy = new algovivo.nn.MLPPolicy({
            system,
            active: true,
            numVertices: POLICY_VERTEX_COUNT,
            numMuscles: POLICY_MUSCLE_COUNT,
          })
          policy.loadData(policyData)
          setDriver('policy')
        } else {
          setDriver('scripted')
        }

        const rect = host.getBoundingClientRect()
        viewport = new SystemViewport({
          system,
          width: Math.max(360, Math.floor(rect.width || 760)),
          height: Math.max(360, Math.floor(rect.height || 560)),
          // Yellow cat with blue neon edges and red straps.
          borderColor: '#1e6fff',
          fillColor: '#f5c400',
          // Transparent canvas: the universe starfield behind it (CSS on
          // .creature-viewport-frame) shows through. No grid — space look.
          gridColor: 'rgba(0, 0, 0, 0)',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          activeMuscleColor: '#ff2a3a',
          inactiveMuscleColor: '#8a1520',
          draggable: true,
          vertexDepths: [...creatureMesh.depth],
          domElementForMoveEvents: host,
        })

        viewport.tracker.targetCenterY = 1.05
        viewport.tracker.visibleWorldWidth = VISIBLE_WORLD_WIDTH
        viewport.domElement.style.width = '100%'
        viewport.domElement.style.height = '100%'
        viewport.domElement.style.display = 'block'
        viewport.domElement.style.borderRadius = '1.15rem'
        viewport.domElement.setAttribute('aria-hidden', 'true')
        host.replaceChildren(viewport.domElement)

        window.addEventListener('resize', resize)
        resize()
        setStatus('walking')
        frameId = window.requestAnimationFrame(loop)
      } catch (error) {
        if (disposed) return
        const message = error instanceof Error ? error.message : 'Failed to start algovivo scene'
        setErrorMessage(message)
        setStatus('error')
      }
    }

    void boot()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      if (viewport?.domElement?.parentElement === host) {
        host.removeChild(viewport.domElement)
      }
      viewport?.dispose?.()
      policy?.dispose?.()
      policy = null
      system = null
      viewport = null
    }
  }, [])

  return (
    <div
      className="algovivo-stage creature-stage-shell"
      data-builder-component="AlgovivoCreatureScene"
      data-builder-id="algovivo-creature-stage"
    >
      <div
        ref={hostRef}
        className="algovivo-viewport creature-viewport-frame"
        data-builder-id="algovivo-creature-viewport"
        aria-label="Soft-bodied cat walking simulation"
      />
    </div>
  )
}
