import { expect, test } from "bun:test"
import "bun-match-svg"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { BgaEscapeRoutingSolver, type BgaEscapeRoutingSolverInput } from "lib"
import capture from "./fixtures/icepi-ram-capacitor-via.json"

test("shows the RAM escape beside the existing DDR copper", async (): Promise<void> => {
  const solver = new BgaEscapeRoutingSolver(
    capture as BgaEscapeRoutingSolverInput,
  )
  solver.solve()

  expect(solver.failure).toBe("no_via_site")
  expect(solver.error).toContain("pcb_port_1043")
  await expect(
    getSvgFromGraphicsObject(solver.visualize(), { backgroundColor: "white" }),
  ).toMatchSvgSnapshot(import.meta.path)
})
