import { expect, test } from "bun:test"
import "bun-match-svg"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { BgaEscapeRoutingSolver, type BgaEscapeRoutingSolverInput } from "lib"
import capture from "./fixtures/icepi-ram-capacitor-via.json"

test("routes the RAM escape beside the existing DDR copper", async (): Promise<void> => {
  const solver = new BgaEscapeRoutingSolver(
    capture as BgaEscapeRoutingSolverInput,
  )
  solver.solve()

  expect(solver.solved).toBe(true)
  const [trace] = solver.getOutput()
  expect(trace!.route[0]).toMatchObject({ start_pcb_port_id: "pcb_port_1043" })
  expect(trace!.route.at(-1)).toMatchObject({
    end_pcb_port_id: "pcb_port_1266",
  })
  const firstVia = trace!.route.find((point) => point.route_type === "via")!
  const ramPad = capture.board.obstacles.find((pad) =>
    pad.connectedTo.includes("pcb_port_1043"),
  )!
  expect(
    Math.hypot(firstVia.x - ramPad.center.x, firstVia.y - ramPad.center.y),
  ).toBeGreaterThan((ramPad.width + capture.board.via.holeDiameter) / 2)
  await expect(
    getSvgFromGraphicsObject(solver.visualize(), { backgroundColor: "white" }),
  ).toMatchSvgSnapshot(import.meta.path)
})
