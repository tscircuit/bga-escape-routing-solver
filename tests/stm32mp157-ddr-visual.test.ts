import { expect, test } from "bun:test"
import "bun-match-svg"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { BgaEscapeRoutingSolver, type BgaEscapeRoutingSolverInput } from "lib"
import capture from "./fixtures/stm32mp157-ddr.json"

test("shows all STM32MP157 branches beside the original fixed data-byte copper", async (): Promise<void> => {
  const solver = new BgaEscapeRoutingSolver(
    capture as BgaEscapeRoutingSolverInput,
  )
  solver.solve()
  await expect(
    getSvgFromGraphicsObject(solver.visualize(), { backgroundColor: "white" }),
  ).toMatchSvgSnapshot(import.meta.path)
})
