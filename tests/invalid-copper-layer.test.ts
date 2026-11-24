import { expect, test } from "bun:test"
import type { BgaRoutingBoard } from "lib"
import { BgaEscapeRoutingSolver } from "lib"

const baseBoard = (): BgaRoutingBoard => ({
  bounds: { minX: -2, maxX: 2, minY: -2, maxY: 2 },
  layerCount: 4,
  minTraceWidth: 0.12,
  minBoardEdgeClearance: 0.2,
  traceClearance: 0.15,
  viaToPadClearance: 0.15,
  via: { padDiameter: 0.4, holeDiameter: 0.2 },
  fixedTraces: [],
  obstacles: [],
  connections: [
    {
      name: "CLOCK",
      pointsToConnect: [
        { x: 0, y: 0, layer: "top", pcb_port_id: "cpu_clock" },
        { x: 1, y: 0, layer: "top", pcb_port_id: "ram_clock" },
      ],
    },
  ],
})

test("copper on a layer name outside the board stackup is rejected", () => {
  const makeSolver = (board: BgaRoutingBoard) =>
    new BgaEscapeRoutingSolver({
      board,
      pointPairs: board.connections,
      signalLayers: [0, 1, 2, 3],
      bga: { center: { x: 0, y: 0 }, pitch: 0.8 },
    })

  // A 4-layer board has no "inner5": its mask writes must not silently no-op.
  const deepTrace = baseBoard()
  deepTrace.fixedTraces = [
    {
      type: "pcb_trace",
      pcb_trace_id: "bogus_layer_trace",
      connection_name: "KEEP",
      route: [
        { route_type: "wire", x: 0.2, y: -1, layer: "inner5", width: 0.2 },
        { route_type: "wire", x: 0.2, y: 1, layer: "inner5", width: 0.2 },
      ],
    },
  ]
  expect(() => makeSolver(deepTrace).solve()).toThrow(/inner5/i)

  // A 4-layer stackup tops out at "inner2": "inner4" must not silently no-op.
  const deepObstacle = baseBoard()
  deepObstacle.obstacles = [
    {
      type: "rect",
      center: { x: 0.5, y: 0.5 },
      width: 0.4,
      height: 0.4,
      layers: ["inner4"],
      connectedTo: [],
    },
  ]
  expect(() => makeSolver(deepObstacle).solve()).toThrow(/inner4/i)
})
