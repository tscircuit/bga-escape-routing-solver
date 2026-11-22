import type { BgaEscapeRoutingSolverInput, BgaRoutingBoard } from "lib"

const pads = [
  { x: -0.8, y: 0 },
  { x: 0.8, y: 0 },
]
const board: BgaRoutingBoard = {
  bounds: { minX: -2, minY: -1.2, maxX: 2, maxY: 1.2 },
  layerCount: 4,
  minTraceWidth: 0.127,
  traceClearance: 0.127,
  viaToPadClearance: 0.127,
  via: { padDiameter: 0.327, holeDiameter: 0.2 },
  obstacles: pads.map((center, i) => ({
    type: "rect",
    shape: "circle",
    center,
    width: 0.4,
    height: 0.4,
    layers: ["top"],
    connectedTo: [`port_${i}`],
  })),
  fixedTraces: [
    {
      type: "pcb_trace",
      pcb_trace_id: "data",
      connection_name: "DATA",
      route: [
        {
          route_type: "wire",
          x: -1.3,
          y: -0.65,
          layer: "inner2",
          width: 0.127,
        },
        { route_type: "wire", x: 1.3, y: -0.65, layer: "inner2", width: 0.127 },
      ],
    },
  ],
  connections: [
    {
      name: "CLOCK",
      pointsToConnect: pads.map((center, i) => ({
        ...center,
        layer: "top",
        pcb_port_id: `port_${i}`,
      })),
    },
  ],
}

export const twoPadEscape: BgaEscapeRoutingSolverInput = {
  board,
  pointPairs: board.connections,
  bga: { center: pads[0]!, pitch: 0.8 },
  signalLayers: [0, 2],
}
