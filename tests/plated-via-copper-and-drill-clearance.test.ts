import { expect, test } from "bun:test"
import { BgaRoutingCopper } from "lib/bga-escape-routing/BgaRoutingCopper"
import { BgaRoutingGrid } from "lib/bga-escape-routing/BgaRoutingGrid"
import { twoPadEscape } from "./fixtures/two-pad-escape"

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
