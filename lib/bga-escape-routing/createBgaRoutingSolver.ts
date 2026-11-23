import { BgaEscapeRoutingSolver } from "./BgaEscapeRoutingSolver"
import { BgaSurfaceRoutingSolver } from "./BgaSurfaceRoutingSolver"
import type { BgaRoutingSolverInput } from "./types"

export type BgaRoutingSolver = BgaEscapeRoutingSolver | BgaSurfaceRoutingSolver

/**
 * Prefer board-wide surface routing when every inner layer is reserved.
 * Otherwise a regional router can use the available signal layers.
 */
export function createBgaRoutingSolver(
  input: BgaRoutingSolverInput,
  options?: { regionalRoutingAvailable: boolean },
): BgaRoutingSolver | undefined {
  const bottomLayer = input.board.layerCount - 1
  const hasInnerSignalLayer = input.signalLayers.some(
    (z) => z > 0 && z < bottomLayer,
  )
  const hasBothSurfaces =
    input.signalLayers.includes(0) && input.signalLayers.includes(bottomLayer)
  if (!hasInnerSignalLayer && (!hasBothSurfaces || bottomLayer === 0)) return
  if (
    options?.regionalRoutingAvailable &&
    (bottomLayer < 2 || hasInnerSignalLayer)
  ) {
    return
  }
  return hasInnerSignalLayer
    ? new BgaEscapeRoutingSolver(input)
    : new BgaSurfaceRoutingSolver(input)
}
