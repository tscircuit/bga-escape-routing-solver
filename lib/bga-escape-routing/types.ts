/** Board coordinates in millimetres, with +X right and +Y up. */
export type BoardPoint = { x: number; y: number }

export type BgaConnectionPoint = BoardPoint & {
  layer?: string
  pcb_port_id?: string
  pointId?: string
}

export interface BgaConnection {
  name: string
  rootConnectionName?: string
  __rootConnectionNames?: string[]
  source_trace_id?: string
  escapeWidth?: number
  nominalTraceWidth?: number
  width?: number
  pointsToConnect: BgaConnectionPoint[]
}

export type BgaWire = BoardPoint & {
  route_type: "wire"
  layer: string
  width: number
  start_pcb_port_id?: string
  end_pcb_port_id?: string
}

export type BgaVia = BoardPoint & {
  route_type: "via"
  from_layer: string
  to_layer: string
  layers?: string[]
  via_diameter?: number
  via_hole_diameter?: number
}

export interface BgaTrace {
  type: "pcb_trace"
  pcb_trace_id: string
  connection_name: string
  source_trace_id?: string
  route: (BgaWire | BgaVia)[]
}

export interface BgaRoutingPad {
  type: "rect"
  shape?: "circle"
  center: BoardPoint
  width: number
  height: number
  ccwRotationDegrees?: number
  layers: string[]
  connectedTo: string[]
  isNonPlatedHole?: boolean
}

export interface BgaRoutingBoard {
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  layerCount: number
  minTraceWidth: number
  minBoardEdgeClearance?: number
  minViaHoleEdgeToViaHoleEdgeClearance?: number
  minTraceToHoleEdgeClearance?: number
  minViaChannelWidth?: number
  reuseFixedCopper?: boolean
  interstitialViasOnly?: boolean
  requireAllPadViaClearance?: boolean
  allowOwnedViaReuse?: boolean
  maxLocalEscapePitches?: number
  traceClearance: number
  viaToPadClearance: number
  via: { padDiameter: number; holeDiameter: number }
  obstacles: BgaRoutingPad[]
  connections: BgaConnection[]
  fixedTraces: BgaTrace[]
}

export interface BgaEscapeRoutingSolverInput {
  terminalOrderBias?: string[]
  memoryBudgetBytes?: number
  board: BgaRoutingBoard
  bga: { center: BoardPoint; pitch: number }
  /** Layer indices increase from top (0) to bottom (layerCount - 1). */
  signalLayers: number[]
  pointPairs: BgaConnection[]
}
