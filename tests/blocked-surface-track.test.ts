import { expect, test } from "bun:test"
import { BgaSurfaceRoutingSolver } from "lib"
import { twoPadEscape } from "./fixtures/two-pad-escape"

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
