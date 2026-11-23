import { expect, test } from "bun:test"
import {
  BgaEscapeRoutingSolver,
  BgaSurfaceRoutingSolver,
  createBgaRoutingSolver,
} from "lib"
import { twoPadEscape } from "./fixtures/two-pad-escape"

test("selects a BGA solver from the signal layers and regional routing availability", () => {
  const outerLayersOnly = { ...twoPadEscape, signalLayers: [0, 3] }
  const withInnerLayer = { ...twoPadEscape, signalLayers: [0, 1, 3] }
  const regional = { regionalRoutingAvailable: true }
  const twoLayerBoard = {
    ...twoPadEscape,
    board: { ...twoPadEscape.board, layerCount: 2 },
    signalLayers: [0, 1],
  }

  expect(createBgaRoutingSolver(twoLayerBoard)).toBeInstanceOf(
    BgaSurfaceRoutingSolver,
  )
  expect(createBgaRoutingSolver(outerLayersOnly)).toBeInstanceOf(
    BgaSurfaceRoutingSolver,
  )
  expect(createBgaRoutingSolver(withInnerLayer)).toBeInstanceOf(
    BgaEscapeRoutingSolver,
  )
  expect(createBgaRoutingSolver(outerLayersOnly, regional)).toBeInstanceOf(
    BgaSurfaceRoutingSolver,
  )
  expect(createBgaRoutingSolver(withInnerLayer, regional)).toBeUndefined()
  expect(createBgaRoutingSolver(twoLayerBoard, regional)).toBeUndefined()
  expect(
    createBgaRoutingSolver({ ...twoPadEscape, signalLayers: [0] }),
  ).toBeUndefined()
})
