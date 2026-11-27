import type { BoardPoint } from "./types"

type ViaClearanceConstraint = {
  distance: (x: number, y: number) => number
  requiredClearance: number
}

type SearchCell = BoardPoint & { halfSize: number }

/** Locate a legal via center in a square of board-world coordinates (mm).
 * Distance to copper can increase by at most the distance moved. A cell
 * can be discarded when even its farthest corner cannot clear a constraint.
 */
export function findViaCenterInCell(
  cell: SearchCell,
  constraints: ViaClearanceConstraint[],
): BoardPoint | undefined {
  const pending = [cell]
  // PCB coordinates are searched to one micrometre.
  const precisionMm = 0.001
  while (pending.length) {
    const { x, y, halfSize } = pending.pop()!
    const radius = Math.SQRT2 * halfSize
    let clearance = Infinity
    for (const constraint of constraints) {
      clearance = Math.min(
        clearance,
        constraint.distance(x, y) - constraint.requiredClearance,
      )
      if (clearance + radius <= 0) break
    }
    if (clearance > 0) return { x, y }
    if (clearance + radius <= 0 || radius <= precisionMm) continue

    const nextHalfSize = halfSize / 2
    for (const dx of [-nextHalfSize, nextHalfSize]) {
      for (const dy of [-nextHalfSize, nextHalfSize]) {
        pending.push({ x: x + dx, y: y + dy, halfSize: nextHalfSize })
      }
    }
  }
}
