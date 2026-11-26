import { expect, test } from "bun:test"
import { BgaEscapeRoutingSolver } from "lib"
import { twoPadEscape } from "./fixtures/two-pad-escape"

test("fails explicitly when a point pair matches no board connection", () => {
  const solver = new BgaEscapeRoutingSolver({
    ...twoPadEscape,
    pointPairs: [
      ...twoPadEscape.pointPairs,
      {
        name: "MISSING_NET",
        pointsToConnect: [
          { x: -0.8, y: 0, layer: "top", pcb_port_id: "port_0" },
          { x: 0.8, y: 0, layer: "top", pcb_port_id: "port_1" },
        ],
      },
    ],
  })
  solver.solve()

  expect(solver.failure).toBe("unmatched_point_pairs")
  expect(solver.error).toContain("MISSING_NET")
  expect(solver.solved).toBe(false)
  expect(() => solver.getOutput()).toThrow()
})
