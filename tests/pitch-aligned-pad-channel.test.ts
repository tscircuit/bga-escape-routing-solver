import { expect, test } from "bun:test"
import { BgaRoutingCopper } from "lib/bga-escape-routing/BgaRoutingCopper"
import { BgaRoutingGrid } from "lib/bga-escape-routing/BgaRoutingGrid"
import type { BgaRoutingBoard } from "lib"

test("keeps a trace-width channel between two BGA balls on the physical pitch grid", () => {
  const ball = { x: -0.317, y: 0.193 }
  const board: BgaRoutingBoard = {
    bounds: { minX: -2.031, maxX: 2.073, minY: -2, maxY: 2 },
    layerCount: 4,
    minTraceWidth: 0.127,
    traceClearance: 0.127,
    viaToPadClearance: 0.127,
    via: { padDiameter: 0.3, holeDiameter: 0.15 },
    fixedTraces: [],
    obstacles: [0, 0.8].map((dx) => ({
      type: "rect",
      shape: "circle",
      center: { x: ball.x + dx, y: ball.y },
      width: 0.4,
      height: 0.4,
      layers: ["top"],
      connectedTo: [],
    })),
    connections: [
      {
        name: "ADDRESS",
        pointsToConnect: [
          { x: ball.x + 0.4, y: -1, layer: "top" },
          { x: ball.x + 0.4, y: 1, layer: "top" },
        ],
      },
    ],
  }
  const grid = new BgaRoutingGrid({
    board,
    signalLayers: [0, 1, 2, 3],
    bga: { center: ball, pitch: 0.8 },
  })
  const copper = new BgaRoutingCopper(grid, board)
  const channel = grid.getCell({ x: ball.x + 0.4, y: ball.y }, 0)!
  const wireMask = copper.wires.get(0.127)!

  // The 0.019 mm of free centerline width fits the center sample only.
  expect(grid.getPoint(channel).x).toBeCloseTo(ball.x + 0.4, 9)
  expect(wireMask[channel]).toBe(0)
  expect(wireMask[channel - 1]).toBe(-1)
  expect(wireMask[channel + 1]).toBe(-1)
})
