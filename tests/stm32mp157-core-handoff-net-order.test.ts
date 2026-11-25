import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import "bun-match-svg"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { BgaEscapeRoutingSolver, type BgaEscapeRoutingSolverInput } from "lib"

const input = JSON.parse(
  gunzipSync(
    readFileSync(
      new URL("./fixtures/stm32mp157-core-handoff.json.gz", import.meta.url),
    ),
  ).toString("utf8"),
) as BgaEscapeRoutingSolverInput

test("connects all 99 STM32MP157 branches once each closed net is routed first", async (): Promise<void> => {
  const solver = new BgaEscapeRoutingSolver(input)
  solver.solve()
  expect(solver.error).toBeNull()
  expect(solver.stats.promotedNets).toBe(6)
  const routes = solver.getOutput()
  expect(routes).toHaveLength(99)
  const endpointsByBranch = new Map(
    input.pointPairs.map((pair) => [
      pair.name,
      pair.pointsToConnect.map((point) => point.pcb_port_id).sort(),
    ]),
  )
  for (const trace of routes) {
    const wires = trace.route.filter((point) => point.route_type === "wire")
    expect(
      [wires[0]?.start_pcb_port_id, wires.at(-1)?.end_pcb_port_id].sort(),
    ).toEqual(endpointsByBranch.get(trace.connection_name)!)
    endpointsByBranch.delete(trace.connection_name)
  }
  expect(endpointsByBranch.size).toBe(0)
  await expect(
    getSvgFromGraphicsObject(solver.visualize(), { backgroundColor: "white" }),
  ).toMatchSvgSnapshot(import.meta.path)
})
