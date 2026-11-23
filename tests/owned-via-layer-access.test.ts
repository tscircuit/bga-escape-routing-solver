import { expect, test } from "bun:test"
import { BgaEscapeRoutingSolver, type BgaEscapeRoutingSolverInput } from "lib"

test("reuses exact physical via coordinates across a blocked layer without inventing a missing span", () => {
  const input: BgaEscapeRoutingSolverInput = {
    board: {
      bounds: { minX: -1, maxX: 2, minY: -1, maxY: 1 },
      layerCount: 4,
      minTraceWidth: 0.1,
      traceClearance: 0.1,
      viaToPadClearance: 0.1,
      reuseFixedCopper: true,
      allowOwnedViaReuse: true,
      via: { padDiameter: 0.35, holeDiameter: 0.15 },
      obstacles: [
        {
          type: "rect",
          center: { x: 0.75, y: 0 },
          width: 0.2,
          height: 3,
          layers: ["inner1"],
          connectedTo: [],
        },
      ],
      connections: [
        {
          name: "DATA",
          pointsToConnect: [
            { x: 0.31, y: 0.29, layer: "inner1", pointId: "left" },
            { x: 1.21, y: 0.37, layer: "inner1", pointId: "right" },
          ],
        },
      ],
      fixedTraces: [
        {
          type: "pcb_trace",
          pcb_trace_id: "supplied_barrels",
          connection_name: "DATA",
          route: [
            {
              route_type: "via",
              x: 0.31,
              y: 0.29,
              from_layer: "top",
              to_layer: "bottom",
              layers: ["top", "inner1", "inner2", "bottom"],
            },
            {
              route_type: "via",
              x: 1.21,
              y: 0.37,
              from_layer: "top",
              to_layer: "bottom",
              layers: ["top", "inner1", "inner2", "bottom"],
            },
          ],
        },
      ],
    },
    bga: { center: { x: 0, y: 0 }, pitch: 0.8 },
    signalLayers: [1, 2],
    pointPairs: [],
  }
  input.pointPairs = input.board.connections
  const solver = BgaEscapeRoutingSolver.createIfApplicable(input)!
  expect(solver).toBeDefined()
  solver.solve()
  expect(solver.solved).toBe(true)
  const route = solver.getOutput()[0]!.route
  expect(
    route
      .filter((point) => point.route_type === "via")
      .map(({ x, y }) => ({ x, y })),
  ).toEqual([
    { x: 0.31, y: 0.29 },
    { x: 1.21, y: 0.37 },
  ])
  const missingSpan = structuredClone(input)
  missingSpan.board.fixedTraces[0]!.route[0] = {
    route_type: "via",
    x: 0.31,
    y: 0.29,
    from_layer: "top",
    to_layer: "inner1",
    layers: ["top", "inner1"],
  }
  expect(() => BgaEscapeRoutingSolver.createIfApplicable(missingSpan)).toThrow()
  const foreignOwner = structuredClone(input)
  foreignOwner.board.fixedTraces[0]!.connection_name = "OTHER"
  expect(() =>
    BgaEscapeRoutingSolver.createIfApplicable(foreignOwner),
  ).toThrow()
})
