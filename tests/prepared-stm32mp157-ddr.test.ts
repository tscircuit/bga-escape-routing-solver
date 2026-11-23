import { expect, test } from "bun:test"
import { BgaEscapeRoutingSolver, type BgaEscapeRoutingSolverInput } from "lib"
import capture from "./fixtures/stm32mp157-ddr.json"

test("preparing STM32MP157 escapes preserves all 97 routed branches", () => {
  const input = capture as BgaEscapeRoutingSolverInput
  const before = structuredClone(input)
  const stepped = new BgaEscapeRoutingSolver(input)
  stepped.solve()
  const prepared = BgaEscapeRoutingSolver.createIfApplicable(input)
  expect(prepared).toBeDefined()
  prepared!.solve()
  expect(prepared!.error).toBeNull()
  expect(prepared!.getOutput()).toHaveLength(97)
  expect(prepared!.getOutput()).toEqual(stepped.getOutput())
  expect(input).toEqual(before)
})
