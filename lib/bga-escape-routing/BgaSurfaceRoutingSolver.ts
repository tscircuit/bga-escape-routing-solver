import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type {
  BgaConnectionName,
  BgaRoutingSolverInput,
  BgaTrace,
} from "./types"
import type { RoutingTerminal } from "./findTerminalEscape"
import { BgaRoutingGrid } from "./BgaRoutingGrid"
import { BgaRoutingCopper } from "./BgaRoutingCopper"
import { BgaTrackSearch } from "./BgaTrackSearch"
import { BgaTrackCongestion, type BgaTrackUsage } from "./BgaTrackCongestion"
import { getBgaRoutingNets, type BgaRoutingNet } from "./getBgaRoutingNets"
import { getBgaTerminalPairs } from "./getBgaTerminalPairs"
import { getSurfaceTraceRoute, type TerminalPair } from "./bgaTraceRoutes"
import { getBgaRoutingGraphics } from "./getBgaRoutingGraphics"

type SurfaceNet = BgaRoutingNet & { pairs: TerminalPair<RoutingTerminal>[] }

const maxRoutingPasses = 64

/** Route directly from surface pads when the board has no interior signal layer for independent escapes. */
export class BgaSurfaceRoutingSolver extends BaseSolver {
  private copper!: BgaRoutingCopper
  private search!: BgaTrackSearch
  private congestion!: BgaTrackCongestion
  private nets: SurfaceNet[] = []
  private netIndex = 0
  private pairIndex = 0
  private pass = 0
  private readonly routesByConnectionName = new Map<
    BgaConnectionName,
    BgaTrace[]
  >()
  private readonly trackUsageByConnectionName = new Map<
    BgaConnectionName,
    BgaTrackUsage
  >()
  private pendingRoutes: BgaTrace[] = []
  private wireCells = new Set<number>()
  private viaSites = new Set<number>()
  failure?:
    | "grid_budget"
    | "terminal_outside_grid"
    | "incomplete_point_pairs"
    | "no_path"
    | "frontier_limit"
    | "congestion"

  constructor(private readonly input: BgaRoutingSolverInput) {
    super()
  }

  override _setup(): void {
    const grid = new BgaRoutingGrid(this.input)
    if (
      grid.innerSignalLayers.length ||
      !grid.signalLayers.includes(0) ||
      !grid.signalLayers.includes(grid.layerCount - 1)
    ) {
      throw new Error("Surface BGA routing requires both outer signal layers")
    }
    if (!grid.fitsMemoryBudget()) {
      this.failed = true
      this.failure = "grid_budget"
      this.error = "The surface BGA routing grid exceeds the memory budget"
      return
    }
    const routing = getBgaRoutingNets(this.input, grid)
    if ("error" in routing) {
      this.failed = true
      this.failure = "terminal_outside_grid"
      this.error = routing.error
      return
    }
    for (const net of routing.nets) {
      const pairs = getBgaTerminalPairs(net, grid)
      if (!pairs?.length) {
        this.failed = true
        this.failure = "incomplete_point_pairs"
        this.error = `Point pairs do not span all terminals of ${net.connection.name}`
        return
      }
      this.nets.push({ ...net, pairs })
    }
    this.nets.sort((first, second) => first.span - second.span)
    this.stats = { pass: 0, routedNets: 0, conflictingNets: this.nets.length }
    this.copper = new BgaRoutingCopper(grid, this.input.board)
    this.congestion = new BgaTrackCongestion(grid)
    this.search = new BgaTrackSearch(this.copper)
  }

  override _step(): void {
    if (this.netIndex === this.nets.length) {
      this.finishPass()
      return
    }
    const net = this.nets[this.netIndex]!
    const pair = net.pairs[this.pairIndex]!
    const { start, end } = pair
    if (!this.search.active) {
      if (!this.pairIndex) {
        const previous = this.trackUsageByConnectionName.get(
          net.connection.name,
        )
        if (previous) this.congestion.applyFootprint(previous.footprint, -1)
        this.congestion.selectWidth(start.width)
      }
      this.search.start({
        start: start.cell,
        end: end.cell,
        owner: start.owner,
        width: start.width,
        congestion: this.congestion,
      })
    }
    this.search.step()
    if (this.search.failure) {
      this.failed = true
      this.failure = this.search.failure
      this.error = `Surface BGA track search ${this.failure} for ${pair.connectionName} (${start.terminalId} to ${end.terminalId})`
      return
    }
    const path = this.search.path
    if (!path) return
    this.pendingRoutes.push({
      type: "pcb_trace",
      pcb_trace_id: `bga_${net.connection.name}_${this.pairIndex}`,
      connection_name: pair.connectionName,
      source_trace_id: net.connection.source_trace_id ?? net.connection.name,
      route: getSurfaceTraceRoute({ ...pair, path }, this.copper),
    })
    const { layerSize } = this.copper.grid
    for (const [index, cell] of path.entries()) {
      this.wireCells.add(cell)
      if (index && Math.abs(cell - path[index - 1]!) >= layerSize)
        this.viaSites.add(cell % layerSize)
    }
    this.pairIndex++
    if (this.pairIndex < net.pairs.length) return
    const footprint = this.copper.getRouteFootprint(this.pendingRoutes)
    this.congestion.applyFootprint(footprint, 1)
    this.trackUsageByConnectionName.set(net.connection.name, {
      width: start.width,
      wireCells: this.wireCells,
      viaSites: this.viaSites,
      footprint,
    })
    this.routesByConnectionName.set(net.connection.name, this.pendingRoutes)
    this.wireCells = new Set()
    this.viaSites = new Set()
    this.pendingRoutes = []
    this.netIndex++
    this.pairIndex = 0
    this.stats.routedNets = this.netIndex
  }

  private finishPass(): void {
    const conflicts = this.congestion.recordConflicts(
      this.trackUsageByConnectionName,
    )
    this.pass++
    this.stats = {
      pass: this.pass,
      routedNets: this.nets.length,
      conflictingNets: conflicts.size,
    }
    if (!conflicts.size) {
      this.solved = true
      return
    }
    if (this.pass >= maxRoutingPasses) {
      this.failed = true
      this.failure = "congestion"
      this.error = `Surface BGA routing could not separate ${conflicts.size} nets in ${this.pass} passes`
      return
    }
    this.nets.sort(
      (first, second) =>
        (conflicts.get(second.connection.name) ?? 0) -
          (conflicts.get(first.connection.name) ?? 0) ||
        first.span - second.span,
    )
    this.netIndex = 0
  }

  computeProgress(): number {
    if (this.solved) return 1
    return this.pass ? 1 - this.stats.conflictingNets / this.nets.length : 0
  }

  override getOutput(): BgaTrace[] {
    if (!this.solved) throw new Error("Surface BGA routing has not completed")
    return Array.from(this.routesByConnectionName.values()).flat()
  }

  override getConstructorParams(): [BgaRoutingSolverInput] {
    return [this.input]
  }

  override visualize(): GraphicsObject {
    return getBgaRoutingGraphics({
      board: this.input.board,
      countedTerminals: [],
      reservedEscapes: [],
      routes: Array.from(this.routesByConnectionName.values()).flat(),
    })
  }
}
