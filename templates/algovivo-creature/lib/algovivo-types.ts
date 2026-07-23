export type AlgovivoTensor = {
  set: (values: unknown) => void
  toArray?: () => number[] | number[][]
  dispose?: () => void
}

export type AlgovivoSystem = {
  set: (mesh: {
    pos: number[][]
    triangles: number[][]
    muscles: number[][]
    l0?: number[]
    rsi?: number[][][]
    trianglesRsi?: number[][][]
    musclesL0?: number[]
  }) => void
  step: () => void
  /** Backward-Euler timestep (default ~0.033). */
  h?: number
  a: AlgovivoTensor
  pos?: AlgovivoTensor
  numVertices?: number
  numMuscles?: number
  triangles: { indices: { toArray: () => number[][] } }
  muscles: { indices: { toArray: () => number[][] } }
  ten?: unknown
}

export type AlgovivoViewport = {
  domElement: HTMLElement
  render: () => void
  setSize: (size: { width: number; height: number }) => void
  tracker: {
    targetCenterY: number
    targetCenterX?: number
    visibleWorldWidth?: number
    offsetX?: number
  }
  camera?: {
    domToWorldSpace?: (p: [number, number]) => [number, number]
    worldToDomSpace?: (p: [number, number]) => [number, number]
  }
  floor?: {
    mesh?: {
      lines?: number[][]
      lineShader?: {
        renderLine?: (...args: unknown[]) => void
      }
    }
  }
  needsMeshUpdate?: boolean
  setSortedVertexIdsFromVertexDepths?: (depths: number[]) => void
  dispose?: () => void
}

export type AlgovivoPolicy = {
  active: boolean
  loadData: (data: unknown) => void
  step: () => void
  dispose?: () => void
}

export type AlgovivoModule = {
  System: new (opts: { wasmInstance: WebAssembly.Instance }) => AlgovivoSystem
  SystemViewport: new (opts: {
    system: AlgovivoSystem
    width?: number
    height?: number
    headless?: boolean
    borderColor?: string
    fillColor?: string
    gridColor?: string
    backgroundColor?: string
    backgroundCenterColor?: string
    backgroundOuterColor?: string
    activeMuscleColor?: string | number[]
    inactiveMuscleColor?: string | number[]
    draggable?: boolean
    sortedVertexIds?: number[]
    vertexDepths?: number[]
    domElementForMoveEvents?: HTMLElement | null
  }) => AlgovivoViewport
  render?: {
    SystemViewport: AlgovivoModule['SystemViewport']
  }
  nn?: {
    MLPPolicy: new (opts: {
      system: AlgovivoSystem
      active?: boolean
      numVertices?: number
      numMuscles?: number
    }) => AlgovivoPolicy
  }
}
