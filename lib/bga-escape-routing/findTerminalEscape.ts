import FlatQueue from "flatqueue"
import type { BoardPoint, BgaConnectionPoint, BgaTerminalId } from "./types"
import { cellsPerBallPitch, gridNeighbors } from "./BgaRoutingGrid"
import type { BgaRoutingCopper } from "./BgaRoutingCopper"

export type RoutingTerminal = {
  point: BgaConnectionPoint & { layer: string }
  owner: number
  width: number
  terminalId: BgaTerminalId
  cell: number
}

export type TerminalEscape = {
  path: number[]
  viaSite: number
  viaCenter?: BoardPoint
}
const maxCountedSites = 128

type EscapeSearch = { terminal: RoutingTerminal; countSites: boolean }
export type EscapeSites = {
  count: number
  distance: number
  escape?: TerminalEscape
}

function getEscapePath(cell: number, parents: Map<number, number>): number[] {
  const path = [cell]
  while (parents.has(cell)) {
    cell = parents.get(cell)!
    path.push(cell)
  }
  return path.reverse()
}

/** Count nearby via sites before reserving the most constrained pads first. */
export function findTerminalEscape(
  { terminal, countSites }: EscapeSearch,
  copper: BgaRoutingCopper,
): EscapeSites {
  const { grid } = copper
  const wireMask = copper.wires.get(terminal.width)!
  const origin = terminal.cell
  if (wireMask[origin] !== 0 && wireMask[origin] !== terminal.owner) {
    return { count: 0, distance: Infinity }
  }
  const costs = new Map<number, number>([[origin, 0]])
  const parents = new Map<number, number>()
  const frontier = new FlatQueue<{ cell: number; cost: number }>()
  frontier.push({ cell: origin, cost: 0 }, 0)
  let count = 0
  let distance = Infinity
  // Search up to three pitches along the surface. A long excursion is a routing
  // problem in its own right and does not qualify as a local pad escape.
  const maxSteps = 3 * cellsPerBallPitch
  while (frontier.length > 0) {
    const { cell, cost } = frontier.pop()!
    if (cost !== costs.get(cell)) continue
    if (copper.canPlaceVia(cell % grid.layerSize, terminal.owner)) {
      count++
      distance = Math.min(distance, cost)
      if (!countSites) {
        return {
          count,
          distance,
          escape: {
            path: getEscapePath(cell, parents),
            viaSite: cell % grid.layerSize,
          },
        }
      }
      // Additional sites cannot make an already unconstrained terminal scarce.
      if (count === maxCountedSites) break
    }
    const col = cell % grid.columns
    const row = Math.floor(cell / grid.columns) % grid.rows
    for (const [dx, dy] of gridNeighbors) {
      const x = col + dx
      const y = row + dy
      if (x < 0 || x >= grid.columns || y < 0 || y >= grid.rows) continue
      const neighbor = cell + dx + dy * grid.columns
      const owner = wireMask[neighbor]
      if (owner !== 0 && owner !== terminal.owner) continue
      const nextCost = cost + (dx && dy ? Math.SQRT2 : 1)
      if (nextCost > maxSteps || nextCost >= (costs.get(neighbor) ?? Infinity))
        continue
      costs.set(neighbor, nextCost)
      parents.set(neighbor, cell)
      // Equal-cost candidates use board X, then board Y, independent of heap order.
      const priority = nextCost + ((x * grid.rows + y) / grid.layerSize) * 1e-9
      frontier.push({ cell: neighbor, cost: nextCost }, priority)
    }
  }
  if (count > 0) return { count, distance }

  // Only the reachable surface cells can host this terminal's escape. A grid
  // center can be obstructed while the surrounding cell still fits the drill.
  const reachable = [...costs].sort(
    ([a, aCost], [b, bCost]) => aCost - bCost || a - b,
  )
  for (const [cell, cost] of reachable) {
    const viaSite = cell % grid.layerSize
    const viaCenter = copper.findTerminalViaCenter({
      site: viaSite,
      owner: terminal.owner,
      traceWidth: terminal.width,
    })
    if (!viaCenter) continue
    count++
    distance = Math.min(distance, cost)
    if (!countSites) {
      return {
        count,
        distance,
        escape: { path: getEscapePath(cell, parents), viaSite, viaCenter },
      }
    }
    if (count === maxCountedSites) break
  }
  return { count, distance }
}
