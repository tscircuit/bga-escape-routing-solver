import { expect, test } from "bun:test"
import type { BgaRoutingBoard } from "lib"
import { BgaRoutingCopper } from "lib/bga-escape-routing/BgaRoutingCopper"
import { BgaRoutingGrid } from "lib/bga-escape-routing/BgaRoutingGrid"

test("native occupancy keeps the declared hole margin for both wires and via copper", () => {
  const board: BgaRoutingBoard = {
    bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
    layerCount: 4,
    minTraceWidth: 0.1,
    minTraceToHoleEdgeClearance: 0.2,
    traceClearance: 0.1,
    viaToPadClearance: 0.1,
    via: { padDiameter: 0.35, holeDiameter: 0.15 },
    fixedTraces: [],
    obstacles: [
      {
        type: "rect",
        shape: "circle",
        center: { x: 0, y: 0 },
        width: 0.4,
        height: 0.4,
        layers: ["top", "inner1", "inner2", "bottom"],
        connectedTo: [],
        isNonPlatedHole: true,
      },
    ],
    connections: [
      {
        name: "DATA",
        pointsToConnect: [
          { x: -0.8, y: 0, layer: "top", pcb_port_id: "source" },
        ],
      },
    ],
  }
  const grid = new BgaRoutingGrid({
    board,
    signalLayers: [1, 2],
    bga: { center: { x: 0, y: 0 }, pitch: 0.4 },
  })
  const copper = new BgaRoutingCopper(grid, board)
  expect(copper.canPlaceVia(grid.getCell({ x: 0.55, y: 0 }, 0)!, 1)).toBe(false)
  expect(copper.canPlaceVia(grid.getCell({ x: 0.6, y: 0 }, 0)!, 1)).toBe(true)
  expect(copper.wires.get(0.1)![grid.getCell({ x: 0.4, y: 0 }, 0)!]).toBe(-1)
  expect(copper.wires.get(0.1)![grid.getCell({ x: 0.5, y: 0 }, 0)!]).toBe(0)
})
