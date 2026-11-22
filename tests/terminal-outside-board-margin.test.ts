import { expect, test } from "bun:test"
import type { BgaRoutingBoard } from "lib"
import { BgaEscapeRoutingSolver } from "lib"

test("explains an unreachable terminal outside the board-edge routing margin", () => {
  const board: BgaRoutingBoard = {
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
          { x: 1.9, y: 0, layer: "top", pcb_port_id: "ram_clock" },
        ],
      },
    ],
  }
  const solver = new BgaEscapeRoutingSolver({
    board,
    pointPairs: board.connections,
    signalLayers: [0, 1, 2, 3],
    bga: { center: { x: 0, y: 0 }, pitch: 0.8 },
  })
  solver.solve()

  expect(solver.failure).toBe("terminal_outside_grid")
  expect(solver.error).toContain("ram_clock")
  expect(solver.solved).toBe(false)
})
