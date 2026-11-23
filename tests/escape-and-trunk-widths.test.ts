import { expect, test } from "bun:test"
import type { BgaRoutingBoard } from "lib"
import type { BgaWire } from "lib/bga-escape-routing/types"
import { BgaRoutingCopper } from "lib/bga-escape-routing/BgaRoutingCopper"
import { BgaRoutingGrid } from "lib/bga-escape-routing/BgaRoutingGrid"
import { getEscapedTraceRoute } from "lib/bga-escape-routing/getEscapedTraceRoute"

test("preserves separate declared surface and trunk widths at both via transitions", () => {
  const board: BgaRoutingBoard = {
    bounds: { minX: -1, maxX: 3, minY: -1, maxY: 1 },
    layerCount: 4,
    minTraceWidth: 0.1,
    traceClearance: 0.1,
    viaToPadClearance: 0.1,
    via: { padDiameter: 0.35, holeDiameter: 0.15 },
    fixedTraces: [],
    obstacles: [],
    connections: [
      {
        name: "POWER",
        nominalTraceWidth: 0.3,
        escapeWidth: 0.1,
        pointsToConnect: [
          { x: 0, y: 0, layer: "top" },
          { x: 2, y: 0, layer: "top" },
        ],
      },
    ],
  }
  const grid = new BgaRoutingGrid({
    board,
    signalLayers: [1, 2],
    bga: { center: { x: 0, y: 0 }, pitch: 0.8 },
  })
  const copper = new BgaRoutingCopper(grid, board)
  const source = grid.getCell({ x: 0, y: 0 }, 0)!,
    left = grid.getCell({ x: 0.5, y: 0 }, 0)!,
    right = grid.getCell({ x: 1.5, y: 0 }, 0)!,
    target = grid.getCell({ x: 2, y: 0 }, 0)!
  const route = getEscapedTraceRoute(
    {
      connectionName: "POWER",
      start: {
        point: { x: 0, y: 0, layer: "top" },
        terminalId: "left",
        owner: 1,
        width: 0.3,
        escapeWidth: 0.1,
        cell: source,
        path: [source, left],
        viaSite: left,
      },
      end: {
        point: { x: 2, y: 0, layer: "top" },
        terminalId: "right",
        owner: 1,
        width: 0.3,
        escapeWidth: 0.1,
        cell: target,
        path: [target, right],
        viaSite: right,
      },
      path: [left + grid.layerSize, right + grid.layerSize],
    },
    copper,
  )
  expect(copper.wires.has(0.1)).toBe(true)
  expect(
    route
      .filter(
        (point): point is BgaWire =>
          point.route_type === "wire" && point.layer === "top",
      )
      .map((point) => point.width),
  ).toEqual([0.1, 0.1, 0.1, 0.1])
  expect(
    route
      .filter(
        (point): point is BgaWire =>
          point.route_type === "wire" && point.layer === "inner1",
      )
      .map((point) => point.width),
  ).toEqual([0.3, 0.3])
})
