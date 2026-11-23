import { expect, test } from "bun:test"
import "bun-match-svg"
import { readFileSync } from "node:fs"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { BgaEscapeRoutingSolver, type BgaEscapeRoutingSolverInput } from "lib"
import { getBgaRoutingGraphics } from "lib/bga-escape-routing/getBgaRoutingGraphics"

test("prepares every connected H616 source without cached copper or pad-overlapping vias", async () => {
  const input: BgaEscapeRoutingSolverInput = JSON.parse(
    new TextDecoder().decode(
      Bun.gunzipSync(
        readFileSync(
          new URL(
            "./fixtures/h616-local-source-input.json.gz",
            import.meta.url,
          ),
        ),
      ),
    ),
  )
  const original = JSON.stringify(input)
  expect(input.board.fixedTraces).toEqual([])
  const solver = BgaEscapeRoutingSolver.prepareLocalSourceEscapes(input)
  expect(solver).toBeDefined()
  const escapes = solver!.getPreparedEscapeTraces()
  expect(escapes).toHaveLength(174)
  expect(new Set(escapes.map((escape) => escape.terminalId)).size).toBe(174)
  expect(JSON.stringify(input)).toBe(original)
  const graphics = getBgaRoutingGraphics({
    board: input.board,
    countedTerminals: [],
    reservedEscapes: escapes,
    routes: [],
  })
  await expect(
    getSvgFromGraphicsObject(graphics, { backgroundColor: "white" }),
  ).toMatchSvgSnapshot(import.meta.path)
})
