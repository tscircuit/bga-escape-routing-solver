import type { BgaRouteFootprint } from "./BgaRoutingCopper"
import type { BgaRoutingGrid } from "./BgaRoutingGrid"
import type { BgaConnectionName } from "./types"

export type BgaTrackUsage = {
  width: number
  wireCells: Set<number>
  viaSites: Set<number>
  footprint: BgaRouteFootprint
}

// A through-via occupies the same site on both signal surfaces.
const viaConflictWeight = 4

/** Counts occupied track and drill sites separately from the permanent board keepouts. */
export class BgaTrackCongestion {
  private readonly wireCounts = new Map<number, Uint16Array>()
  private readonly viaCounts: Uint16Array
  private readonly wireHistory: Float32Array
  private readonly viaHistory: Float32Array
  private activeWireCounts!: Uint16Array
  private presentPenalty = 3

  constructor(private readonly grid: BgaRoutingGrid) {
    for (const width of new Set(grid.widthByConnectionName.values())) {
      this.wireCounts.set(width, new Uint16Array(grid.cellCount))
    }
    this.viaCounts = new Uint16Array(grid.layerSize)
    this.wireHistory = new Float32Array(grid.cellCount)
    this.viaHistory = new Float32Array(grid.layerSize)
  }

  selectWidth(width: number): void {
    this.activeWireCounts = this.wireCounts.get(width)!
  }

  getWirePenalty(cell: number): number {
    return (
      this.wireHistory[cell]! +
      this.activeWireCounts[cell]! * this.presentPenalty
    )
  }

  getViaPenalty(site: number): number {
    return (
      this.viaHistory[site]! +
      this.viaCounts[site]! * this.presentPenalty * viaConflictWeight
    )
  }

  applyFootprint(footprint: BgaRouteFootprint, delta: 1 | -1): void {
    for (const [width, cells] of footprint.wireCells) {
      const counts = this.wireCounts.get(width)!
      for (const cell of cells) counts[cell]! += delta
    }
    for (const site of footprint.viaSites) this.viaCounts[site]! += delta
  }

  /** Add history around competing sites so adjacent, equivalent tracks can separate on the next pass. */
  recordConflicts(
    trackUsageByConnectionName: ReadonlyMap<BgaConnectionName, BgaTrackUsage>,
  ): Map<BgaConnectionName, number> {
    const conflicts = new Map<BgaConnectionName, number>()
    const wireConflicts = new Map<number, number>()
    const viaConflicts = new Map<number, number>()
    for (const [connectionName, track] of trackUsageByConnectionName) {
      const counts = this.wireCounts.get(track.width)!
      let conflictCount = 0
      for (const cell of track.wireCells) {
        if (counts[cell]! < 2) continue
        wireConflicts.set(cell, (wireConflicts.get(cell) ?? 0) + 1)
        conflictCount++
      }
      for (const site of track.viaSites) {
        if (this.viaCounts[site]! < 2) continue
        viaConflicts.set(
          site,
          (viaConflicts.get(site) ?? 0) + viaConflictWeight,
        )
        conflictCount += viaConflictWeight
      }
      if (conflictCount) conflicts.set(connectionName, conflictCount)
    }
    this.updateHistory(wireConflicts, this.wireHistory)
    this.updateHistory(viaConflicts, this.viaHistory)
    this.presentPenalty = Math.min(800, this.presentPenalty * 1.18)
    return conflicts
  }

  private updateHistory(
    conflicts: Map<number, number>,
    history: Float32Array,
  ): void {
    const { columns, rows } = this.grid
    const nearby = new Map<number, number>()
    for (const [cell, count] of conflicts) {
      const col = cell % columns
      const row = Math.floor(cell / columns) % rows
      for (
        let dy = Math.max(-2, -row);
        dy <= Math.min(2, rows - row - 1);
        dy++
      ) {
        for (
          let dx = Math.max(-2, -col);
          dx <= Math.min(2, columns - col - 1);
          dx++
        ) {
          const neighbor = cell + dx + dy * columns
          nearby.set(neighbor, Math.max(count, nearby.get(neighbor) ?? 0))
        }
      }
    }
    for (const [cell, count] of nearby) history[cell]! += count
  }
}
