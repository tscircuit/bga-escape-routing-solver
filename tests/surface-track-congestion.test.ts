import { expect, test } from "bun:test"
import "bun-match-svg"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { BgaSurfaceRoutingSolver, type BgaEscapeRoutingSolverInput } from "lib"
import { twoPadEscape } from "./fixtures/two-pad-escape"

test("separates competing surface tracks while keeping through vias off a fixed inner wire", async () => {
  const rows = [-0.825, -0.275, 0.275, 0.825]
  const connections = rows.map((y, index) => ({
    name: `DATA${index}`,
    nominalTraceWidth: index % 2 ? 0.125 : 0.1,
    pointsToConnect: [
      { x: -2.5, y, layer: "top", pcb_port_id: `left_${index}` },
      { x: 2.5, y: -y, layer: "top", pcb_port_id: `right_${index}` },
    ],
  }))
  const input: BgaEscapeRoutingSolverInput = {
    bga: { center: { x: 0, y: 0 }, pitch: 0.8 },
    signalLayers: [0, 3],
    pointPairs: connections.toReversed(),
    board: {
      bounds: { minX: -3.3, minY: -2.4, maxX: 3.3, maxY: 2.4 },
      layerCount: 4,
      minTraceWidth: 0.1,
      traceClearance: 0.11,
      viaToPadClearance: 0.11,
      via: { padDiameter: 0.45, holeDiameter: 0.3 },
      connections,
      obstacles: connections.flatMap((connection) =>
        connection.pointsToConnect.map((point) => ({
          type: "rect",
          shape: "circle",
          center: point,
          width: 0.3,
          height: 0.3,
          layers: ["top"],
          connectedTo: [connection.name, point.pcb_port_id],
        })),
      ),
      fixedTraces: [
        {
          type: "pcb_trace",
          pcb_trace_id: "fixed_bus",
          connection_name: "BUS",
          route: [
            { route_type: "wire", x: -1.4, y: 0, layer: "inner1", width: 0.18 },
            { route_type: "wire", x: 1.4, y: 0, layer: "inner1", width: 0.18 },
          ],
        },
      ],
    },
  }
  const fixedTraces = structuredClone(input.board.fixedTraces)
  const solver = new BgaSurfaceRoutingSolver(input)
  while (!solver.failed && !solver.solved && !solver.stats.pass) solver.step()
  expect(solver.stats.conflictingNets).toBeGreaterThan(0)
  await expect(
    getSvgFromGraphicsObject(solver.visualize(), { backgroundColor: "white" }),
  ).toMatchSvgSnapshot(import.meta.path, "competing-tracks")

  solver.solve()
  expect(solver.error).toBeNull()
  expect(solver.stats.conflictingNets).toBe(0)
  expect(input.board.fixedTraces).toEqual(fixedTraces)
  const routes = solver.getOutput()
  expect(routes).toHaveLength(connections.length)
  const layers = new Set<string>()
  const vias = routes.flatMap((trace) =>
    trace.route.filter((point) => point.route_type === "via"),
  )
  expect(vias.length).toBeGreaterThan(0)
  for (const via of vias) {
    const dx = Math.max(0, Math.abs(via.x) - 1.4)
    const copperClearance =
      Math.hypot(dx, via.y) - 0.18 / 2 - via.via_diameter! / 2
    expect(copperClearance).toBeGreaterThanOrEqual(
      input.board.traceClearance - 1e-8,
    )
    expect(via.via_diameter).toBe(input.board.via.padDiameter)
    expect(via.via_hole_diameter).toBe(input.board.via.holeDiameter)
  }
  for (const connection of connections) {
    const trace = routes.find(
      (route) => route.connection_name === connection.name,
    )!
    const wires = trace.route.filter((point) => point.route_type === "wire")
    expect(wires[0]!.start_pcb_port_id).toBe(
      connection.pointsToConnect[0]!.pcb_port_id,
    )
    expect(wires.at(-1)!.end_pcb_port_id).toBe(
      connection.pointsToConnect[1]!.pcb_port_id,
    )
    for (const wire of wires) {
      layers.add(wire.layer)
      expect(wire.width).toBe(connection.nominalTraceWidth)
    }
  }
  expect(layers).toEqual(new Set(["top", "bottom"]))
  await expect(
    getSvgFromGraphicsObject(solver.visualize(), { backgroundColor: "white" }),
  ).toMatchSvgSnapshot(import.meta.path, "separated-tracks")
})

test("a keepout across both signal surfaces leaves no route to publish", () => {
  const input = structuredClone(twoPadEscape)
  input.signalLayers = [0, 3]
  input.board.obstacles.push({
    type: "rect",
    center: { x: 0, y: 0 },
    width: 0.55,
    height: 3,
    layers: ["top", "bottom"],
    connectedTo: [],
  })
  const solver = new BgaSurfaceRoutingSolver(input)
  solver.solve()
  expect(solver.failure).toBe("no_path")
  expect(() => solver.getOutput()).toThrow("has not completed")
})
