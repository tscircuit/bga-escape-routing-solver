import { expect, test } from "bun:test"
import "bun-match-svg"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { BgaEscapeRoutingSolver } from "lib"
import { twoPadEscape } from "./fixtures/two-pad-escape"

test("shows the fixed trunk, reserved surface escapes, and completed branch in order", async () => {
  const solver = new BgaEscapeRoutingSolver(twoPadEscape)
  const snapshot = (stage: string) =>
    expect(
      getSvgFromGraphicsObject(solver.visualize(), {
        backgroundColor: "white",
      }),
    ).toMatchSvgSnapshot(import.meta.path, stage)

  const initialStats = solver.stats
  await snapshot("fixed-copper")
  while (!solver.failed && !solver.solved && solver.stats.reservedEscapes < 2)
    solver.step()
  expect(initialStats.reservedEscapes).toBe(0)
  expect(solver.stats.reservedEscapes).toBe(2)
  expect(solver.stats.routedPointPairs).toBe(0)
  await snapshot("reserved-escapes")

  solver.solve()
  expect(solver.getOutput()).toHaveLength(1)
  await snapshot("routed-branch")
})
