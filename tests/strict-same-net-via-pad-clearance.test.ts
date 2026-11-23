import { expect, test } from "bun:test"
import type { BgaRoutingBoard } from "lib"
import { BgaRoutingCopper } from "lib/bga-escape-routing/BgaRoutingCopper"
import { BgaRoutingGrid } from "lib/bga-escape-routing/BgaRoutingGrid"

test("strict via placement clears an owned SMT pad as well as foreign pads", () => {
  const board: BgaRoutingBoard = {
    bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
    layerCount: 4,
    minTraceWidth: 0.1,
    traceClearance: 0.1,
    viaToPadClearance: 0.1,
    requireAllPadViaClearance: true,
    via: { padDiameter: 0.35, holeDiameter: 0.15 },
    fixedTraces: [],
    obstacles: [
      {
        type: "rect",
        shape: "circle",
        center: { x: 0, y: 0 },
        width: 0.4,
        height: 0.4,
        layers: ["top"],
        connectedTo: ["DATA"],
      },
    ],
    connections: [
      {
        name: "DATA",
        pointsToConnect: [{ x: 0, y: 0, layer: "top", pcb_port_id: "source" }],
      },
    ],
  }
  const grid = new BgaRoutingGrid({
    board,
    signalLayers: [1, 2],
    bga: { center: { x: 0, y: 0 }, pitch: 0.8 },
  })
  const nearPad = grid.getCell({ x: 0.3, y: 0 }, 0)!
  const clearPad = grid.getCell({ x: 0.5, y: 0 }, 0)!
  const strict = new BgaRoutingCopper(grid, board)
  const loose = new BgaRoutingCopper(grid, {
    ...board,
    requireAllPadViaClearance: false,
  })
  expect(loose.canPlaceVia(nearPad, 1)).toBe(true)
  expect(strict.canPlaceVia(nearPad, 1)).toBe(false)
  expect(strict.canPlaceVia(clearPad, 1)).toBe(true)
})
