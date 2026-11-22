import { BgaEscapeRoutingSolver } from "./BgaEscapeRoutingSolver"
import { BgaSurfaceRoutingSolver } from "./BgaSurfaceRoutingSolver"
import type { BgaRoutingSolverInput } from "./types"

export type BgaRoutingSolver = BgaEscapeRoutingSolver | BgaSurfaceRoutingSolver

/**
 * Keep an existing regional plan unless it uses an inner layer while the
 * supplied copper shows only surface signal layers. Without a regional plan,
 * choose the BGA solver for the available signal layers.
 */
export function createBgaRoutingSolver(
  input: BgaRoutingSolverInput,
  regionalPlan?: { usesInnerLayer: boolean },
): BgaRoutingSolver | undefined {
  const bottomLayer = input.board.layerCount - 1
  const hasInnerSignalLayer = input.signalLayers.some(
    (z) => z > 0 && z < bottomLayer,
  )
  if (regionalPlan && (!regionalPlan.usesInnerLayer || hasInnerSignalLayer)) {
    return
  }
  return hasInnerSignalLayer
    ? new BgaEscapeRoutingSolver(input)
    : new BgaSurfaceRoutingSolver(input)
}
