import { expect, test } from "bun:test"
import { BgaRoutingCopper } from "lib/bga-escape-routing/BgaRoutingCopper"
import { BgaRoutingGrid } from "lib/bga-escape-routing/BgaRoutingGrid"
import type { BgaRoutingBoard } from "lib"

import { twoPadEscape } from "./fixtures/two-pad-escape"
test("a fixed inner-layer wire blocks a through drill while leaving the surface clear", () => {
  const center = { x: 0, y: 0 }
  const board: BgaRoutingBoard = {
    bounds: { minX: -2, maxX: 2, minY: -2, maxY: 2 },
    layerCount: 4,
    minTraceWidth: 0.12,
    traceClearance: 0.15,
    viaToPadClearance: 0.15,
    via: { padDiameter: 0.4, holeDiameter: 0.2 },
    obstacles: [],
    fixedTraces: [
      {
        type: "pcb_trace",
        pcb_trace_id: "bus_track",
        connection_name: "DATA",
        route: [
          { route_type: "wire", x: -1, y: 0, layer: "inner2", width: 0.12 },
          { route_type: "wire", x: 1, y: 0, layer: "inner2", width: 0.12 },
        ],
      },
    ],
    connections: [
      {
        name: "CLOCK",
        pointsToConnect: [
          { x: 0, y: -1, layer: "top" },
          { x: 0, y: 1, layer: "top" },
        ],
      },
    ],
  }
  const grid = new BgaRoutingGrid({
    board,
    signalLayers: [0, 1, 2, 3],
    bga: { center, pitch: 0.8 },
  })
  const copper = new BgaRoutingCopper(grid, board)
  const wireMask = copper.wires.get(0.12)!

  expect(wireMask[grid.getCell(center, 0)!]).toBe(0)
  expect(wireMask[grid.getCell(center, 2)!]).toBe(-1)
  expect(copper.canPlaceVia(grid.getCell(center, 0)!, 1)).toBe(false)
  expect(copper.canPlaceVia(grid.getCell({ x: 0, y: 0.8 }, 0)!, 1)).toBe(true)
})

test("wire clearance uses the via land while drill spacing can require a wider gap between vias", () => {
  const input = structuredClone(twoPadEscape)
  input.signalLayers = [0, 3]
  input.board.obstacles = []
  input.board.minViaHoleEdgeToViaHoleEdgeClearance = 0.45
  input.board.fixedTraces = [
    {
      type: "pcb_trace",
      pcb_trace_id: "fixed_via",
      connection_name: "DATA",
      route: [
        {
          route_type: "via",
          x: 0,
          y: 0,
          from_layer: "top",
          to_layer: "bottom",
          via_diameter: input.board.via.padDiameter,
          via_hole_diameter: input.board.via.holeDiameter,
        },
      ],
    },
  ]
  const grid = new BgaRoutingGrid(input)
  const copper = new BgaRoutingCopper(grid, input.board)
  const wireMask = copper.wires.get(input.board.minTraceWidth)!
  expect(wireMask[grid.getCell({ x: 0.3, y: 0 }, 0)!]).toBe(-1)
  expect(wireMask[grid.getCell({ x: 0.4, y: 0 }, 0)!]).toBe(0)
  expect(copper.canPlaceVia(grid.getCell({ x: 0.55, y: 0 }, 0)!, 1)).toBe(false)
  expect(copper.canPlaceVia(grid.getCell({ x: 0.7, y: 0 }, 0)!, 1)).toBe(true)
})
