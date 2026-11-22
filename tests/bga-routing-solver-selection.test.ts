import { expect, test } from "bun:test"
import {
  BgaEscapeRoutingSolver,
  BgaSurfaceRoutingSolver,
  createBgaRoutingSolver,
} from "lib"
import { twoPadEscape } from "./fixtures/two-pad-escape"

test("selects a BGA solver from the signal layers and the existing regional plan", () => {
  const outerLayersOnly = { ...twoPadEscape, signalLayers: [0, 3] }
  const withInnerLayer = { ...twoPadEscape, signalLayers: [0, 1, 3] }
  const surfacePlan = { usesInnerLayer: false }
  const innerLayerPlan = { usesInnerLayer: true }
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
  expect(
    createBgaRoutingSolver(outerLayersOnly, innerLayerPlan),
  ).toBeInstanceOf(BgaSurfaceRoutingSolver)
  expect(createBgaRoutingSolver(outerLayersOnly, surfacePlan)).toBeUndefined()
  expect(createBgaRoutingSolver(withInnerLayer, surfacePlan)).toBeUndefined()
  expect(createBgaRoutingSolver(withInnerLayer, innerLayerPlan)).toBeUndefined()
})
