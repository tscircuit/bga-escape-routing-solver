import { expect, test } from "bun:test"
import "bun-match-svg"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { BgaEscapeRoutingSolver } from "lib"
import { twoPadEscape } from "./fixtures/two-pad-escape"

async function expectRoutingSnapshot({
  solver,
  stage,
}: {
  solver: BgaEscapeRoutingSolver
  stage: string
}): Promise<void> {
  await expect(
    getSvgFromGraphicsObject(solver.visualize(), { backgroundColor: "white" }),
  ).toMatchSvgSnapshot(import.meta.path, stage)
}

test("shows the fixed trunk, reserved surface escapes, and completed branch in order", async (): Promise<void> => {
  const solver = new BgaEscapeRoutingSolver(twoPadEscape)

  const initialStats = solver.stats
  await expectRoutingSnapshot({ solver, stage: "fixed-copper" })
  while (!solver.failed && !solver.solved && solver.stats.reservedEscapes < 2)
    solver.step()
  expect(initialStats.reservedEscapes).toBe(0)
  expect(solver.stats.reservedEscapes).toBe(2)
  expect(solver.stats.routedPointPairs).toBe(0)
  await expectRoutingSnapshot({ solver, stage: "reserved-escapes" })

  solver.solve()
  expect(solver.getOutput()).toHaveLength(1)
  await expectRoutingSnapshot({ solver, stage: "routed-branch" })
})
