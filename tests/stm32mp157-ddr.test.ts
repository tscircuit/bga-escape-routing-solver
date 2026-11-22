import { expect, test } from "bun:test"
import { BgaEscapeRoutingSolver, type BgaEscapeRoutingSolverInput } from "lib"
import capture from "./fixtures/stm32mp157-ddr.json"

test("connects all 97 STM32MP157 branches on the original signal layers", () => {
  const input = capture as BgaEscapeRoutingSolverInput
  const fixedCopper = structuredClone(input.board.fixedTraces)
  const solver = new BgaEscapeRoutingSolver(input)
  solver.solve()
  expect(solver.error).toBeNull()
  expect(solver.stats.reservedEscapes).toBe(137)
  const routes = solver.getOutput()
  expect(routes).toHaveLength(97)
  const endpointsByBranch = new Map(
    input.pointPairs.map((pair) => [
      pair.name,
      pair.pointsToConnect.map((point) => point.pcb_port_id).sort(),
    ]),
  )
  const wireLayers = new Set<string>()
  for (const trace of routes) {
    const wires = trace.route.filter((point) => point.route_type === "wire")
    expect(
      [wires[0]?.start_pcb_port_id, wires.at(-1)?.end_pcb_port_id].sort(),
    ).toEqual(endpointsByBranch.get(trace.connection_name)!)
    endpointsByBranch.delete(trace.connection_name)
    for (const wire of wires) wireLayers.add(wire.layer)
    expect(wires.every((wire) => wire.width === 0.127)).toBe(true)
  }
  expect(endpointsByBranch.size).toBe(0)
  expect(wireLayers).toEqual(
    new Set(["top", "inner2", "inner4", "inner5", "bottom"]),
  )
  expect(input.board.fixedTraces).toEqual(fixedCopper)
})
