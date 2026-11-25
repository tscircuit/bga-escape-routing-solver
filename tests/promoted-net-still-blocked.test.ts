import { expect, test } from "bun:test"
import type { BgaRoutingBoard } from "lib"
import { BgaEscapeRoutingSolver } from "lib"

test("promotes a net once and fails when fixed copper still separates its vias", () => {
  const board: BgaRoutingBoard = {
    bounds: { minX: -3, maxX: 3, minY: -1.5, maxY: 1.5 },
    layerCount: 4,
    minTraceWidth: 0.12,
    traceClearance: 0.15,
    viaToPadClearance: 0.15,
    via: { padDiameter: 0.4, holeDiameter: 0.2 },
    fixedTraces: [],
    obstacles: [
      {
        type: "rect",
        center: { x: 0, y: 0 },
        width: 0.4,
        height: 3,
        layers: ["top", "inner1", "inner2", "bottom"],
        connectedTo: [],
      },
    ],
    connections: [
      {
        name: "CLOCK",
        pointsToConnect: [
          { x: -1, y: 0, layer: "top", pcb_port_id: "cpu_clock" },
          { x: 1, y: 0, layer: "top", pcb_port_id: "ram_clock" },
        ],
      },
      {
        name: "RESET",
        pointsToConnect: [
          { x: -2.4, y: 0.8, layer: "top", pcb_port_id: "cpu_reset" },
          { x: -1.6, y: 0.8, layer: "top", pcb_port_id: "button_reset" },
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

  expect(solver.failure).toBe("no_path")
  expect(solver.error).toContain("cpu_clock to ram_clock")
  expect(solver.stats.promotedNets).toBe(1)
  expect(solver.stats.routedPointPairs).toBe(0)
  expect(solver.solved).toBe(false)
})
