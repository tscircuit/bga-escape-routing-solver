import { expect, test } from "bun:test"
import type { BgaRoutingBoard } from "lib"
import { BgaRoutingGrid } from "lib/bga-escape-routing/BgaRoutingGrid"

test("board edge clearance includes escape copper wider than the trunk and via", () => {
  const board: BgaRoutingBoard = {
    bounds: { minX: 0, maxX: 4, minY: 0, maxY: 4 },
    layerCount: 4,
    minTraceWidth: 0.1,
    minBoardEdgeClearance: 0.1,
    traceClearance: 0.1,
    viaToPadClearance: 0.1,
    via: { padDiameter: 0.35, holeDiameter: 0.15 },
    fixedTraces: [],
    obstacles: [],
    connections: [
      {
        name: "POWER",
        nominalTraceWidth: 0.1,
        escapeWidth: 0.8,
        pointsToConnect: [
          { x: 1, y: 1, layer: "top" },
          { x: 3, y: 3, layer: "top" },
        ],
      },
    ],
  }
  const grid = new BgaRoutingGrid({
    board,
    signalLayers: [1, 2],
    bga: { center: { x: 0, y: 0 }, pitch: 0.8 },
  })
  expect(grid.origin).toEqual({ x: 0.5, y: 0.5 })
  expect(grid.getPoint(grid.layerSize - 1)).toEqual({ x: 3.5, y: 3.5 })
  const narrowBoard: BgaRoutingBoard = {
    ...board,
    connections: [{ ...board.connections[0], escapeWidth: undefined }],
  }
  const narrowGrid = new BgaRoutingGrid({
    board: narrowBoard,
    signalLayers: [1, 2],
    bga: { center: { x: 0, y: 0 }, pitch: 0.8 },
  })
  expect(narrowGrid.origin.x).toBeCloseTo(0.3, 8)
  expect(narrowGrid.getPoint(narrowGrid.layerSize - 1).x).toBeCloseTo(3.7, 8)
  expect(board.connections[0].escapeWidth).toBe(0.8)
})
