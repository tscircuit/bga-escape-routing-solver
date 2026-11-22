import { expect, test } from "bun:test"
import { BgaEscapeRoutingSolver } from "lib"
import type { BgaRoutingBoard } from "lib"

test("bounds the grid allocation across routing layers and trace widths", () => {
  const board: BgaRoutingBoard = {
    bounds: { minX: -40, maxX: 40, minY: -40, maxY: 40 },
    layerCount: 8,
    minTraceWidth: 0.1,
    traceClearance: 0.15,
    viaToPadClearance: 0.15,
    via: { padDiameter: 0.3, holeDiameter: 0.15 },
    fixedTraces: [],
    obstacles: [],
    connections: [
      {
        name: "ADDRESS",
        pointsToConnect: [
          { x: -37, y: -37, layer: "top", pcb_port_id: "source" },
          { x: 37, y: 37, layer: "top", pcb_port_id: "target" },
        ],
      },
    ],
  }
  const solver = new BgaEscapeRoutingSolver({
    board,
    pointPairs: board.connections,
    signalLayers: [0, 2, 4, 5, 7],
    bga: { center: { x: 0, y: 0 }, pitch: 0.4 },
  })
  solver.solve()

  expect(solver.failure).toBe("grid_budget")
  expect(solver.solved).toBe(false)
  expect(() => solver.getOutput()).toThrow()
})
