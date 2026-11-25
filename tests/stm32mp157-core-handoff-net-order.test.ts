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

test("reproduces 38 shorter STM32MP157 nets closing every path of the longest net", async (): Promise<void> => {
  const solver = new BgaEscapeRoutingSolver(input)
  solver.solve()
  expect(solver.failure).toBe("no_path")
  expect(solver.error).toBe(
    "BGA track search no_path for source_net_15_mst2 (pcb_port_11 to pcb_port_455)",
  )
  expect(solver.stats.routedPointPairs).toBe(88)
  await expect(
    getSvgFromGraphicsObject(solver.visualize(), { backgroundColor: "white" }),
  ).toMatchSvgSnapshot(import.meta.path)
})
