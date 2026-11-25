import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type {
  BgaConnection,
  BgaTrace,
  BgaEscapeRoutingSolverInput,
} from "./types"
import { getLayerIndex } from "./routingLayers"
import { getBgaRoutingGraphics } from "./getBgaRoutingGraphics"
import { BgaRoutingCopper } from "./BgaRoutingCopper"
import { BgaRoutingGrid } from "./BgaRoutingGrid"
import { BgaTrackSearch } from "./BgaTrackSearch"
import {
  findTerminalEscape,
  type RoutingTerminal,
  type EscapeSites,
} from "./findTerminalEscape"
import { getEscapedTerminalPairs } from "./getEscapedTerminalPairs"
import {
  getEscapedTraceRoute,
  getReservedEscapeRoute,
  type EscapedTerminal,
  type TerminalPair,
} from "./getEscapedTraceRoute"

type Net = {
  connection: BgaConnection
  pointPairs: BgaConnection[]
  terminals: RoutingTerminal[]
  span: number
}
type RoutingFailure =
  | "grid_budget"
  | "terminal_outside_grid"
  | "no_via_site"
  | "incomplete_point_pairs"
  | "no_path"
  | "frontier_limit"
type RoutingStage =
  | "count_escape_sites"
  | "reserve_escapes"
  | "route_connections"

/** Plan narrow BGA surface escapes before the interconnect competes for through-via sites. */
export class BgaEscapeRoutingSolver extends BaseSolver {
  private copper!: BgaRoutingCopper
  private nets: Net[] = []
  private terminals: RoutingTerminal[] = []
  private readonly sites = new Map<RoutingTerminal, EscapeSites>()
  private readonly escapes = new Map<RoutingTerminal, EscapedTerminal>()
  private stage: RoutingStage = "count_escape_sites"
  private terminalIndex = 0
  private netIndex = 0
  private pairs: TerminalPair[] = []
  private pairIndex = 0
  failure?: RoutingFailure
  private search!: BgaTrackSearch
  private readonly routes: BgaTrace[] = []
  private readonly promotedNets = new Set<Net>()

  constructor(private readonly input: BgaEscapeRoutingSolverInput) {
    super()
    this.updateRoutingStats()
  }

  private updateRoutingStats(): void {
    this.stats = {
      stage: this.stage,
      countedTerminals: this.sites.size,
      reservedEscapes: this.escapes.size,
      routedPointPairs: this.routes.length,
      promotedNets: this.promotedNets.size,
    }
  }

  override _setup(): void {
    const { board } = this.input
    const grid = new BgaRoutingGrid(this.input)
    if (!grid.fitsMemoryBudget()) {
      this.failure = "grid_budget"
      this.failed = true
      const dimensions = [grid.columns, grid.rows, grid.layerCount].join(" × ")
      this.error = `BGA grid exceeds the available routing area or memory budget (${dimensions})`
      return
    }
    for (const [index, connection] of board.connections.entries()) {
      let span = 0
      const width = grid.widthByConnectionName.get(connection.name)!
      const terminals: RoutingTerminal[] = []
      for (const [pointIndex, point] of connection.pointsToConnect.entries()) {
        const terminalId = point.pcb_port_id ?? point.pointId
        if (
          !terminalId ||
          (point.layer !== "top" && point.layer !== "bottom")
        ) {
          throw new Error(
            `Expected a surface pad terminal for ${connection.name}`,
          )
        }
        const z = getLayerIndex(point.layer, board.layerCount)
        const cell = grid.getCell(point, z)
        if (cell === undefined) {
          this.failure = "terminal_outside_grid"
          this.failed = true
          this.error = `BGA terminal ${terminalId} is outside the board-edge routing margin`
          return
        }
        const previous = connection.pointsToConnect[pointIndex - 1]
        if (previous)
          span += Math.hypot(point.x - previous.x, point.y - previous.y)
        terminals.push({
          point: { ...point, layer: point.layer },
          owner: index + 1,
          width,
          terminalId,
          cell,
        })
      }
      const pointPairs = this.input.pointPairs.filter(
        (pair) =>
          pair.name === connection.name ||
          pair.rootConnectionName === connection.name ||
          pair.__rootConnectionNames?.includes(connection.name),
      )
      this.nets.push({ connection, pointPairs, terminals, span })
      this.terminals.push(...terminals)
    }
    this.nets.sort((a, b) => a.span - b.span)
    this.copper = new BgaRoutingCopper(grid, board)
    this.search = new BgaTrackSearch(this.copper)
  }

  override _step(): void {
    if (this.stage !== "route_connections") {
      this.planNextTerminal()
      this.updateRoutingStats()
      return
    }
    const net = this.nets[this.netIndex]
    if (!net) {
      this.solved = true
      return
    }
    if (this.pairs.length === 0) {
      const pairs = getEscapedTerminalPairs(
        {
          terminals: net.terminals.map(
            (terminal) => this.escapes.get(terminal)!,
          ),
          pointPairs: net.pointPairs,
        },
        this.copper.grid,
      )
      if (!pairs?.length) {
        this.failure = "incomplete_point_pairs"
        this.failed = true
        this.error = `Point pairs do not span all BGA terminals for ${net.connection.name}`
        return
      }
      this.pairs = pairs
    }
    const pair = this.pairs[this.pairIndex]!
    const { grid } = this.copper
    if (!this.search.active) {
      // Spread the starts of successive nets over the proven inner signal layers.
      // Both reserved through-vias can reach every one of these layers.
      const layer =
        grid.innerSignalLayers[this.netIndex % grid.innerSignalLayers.length]!
      this.search.start({
        start: layer * grid.layerSize + pair.start.viaSite,
        end: layer * grid.layerSize + pair.end.viaSite,
        owner: pair.start.owner,
        width: pair.start.width,
      })
    }
    this.search.step()
    if (this.search.failure === "no_path" && this.restartWithNetFirst(net)) return
    if (this.search.failure) {
      this.failure = this.search.failure
      this.failed = true
      const terminals = `${pair.start.terminalId} to ${pair.end.terminalId}`
      this.error = `BGA track search ${this.failure} for ${pair.connectionName} (${terminals})`
      return
    }
    if (!this.search.path) return
    const trace = {
      type: "pcb_trace" as const,
      pcb_trace_id: `bga_${net.connection.name}_${this.pairIndex}`,
      connection_name: pair.connectionName,
      source_trace_id: net.connection.source_trace_id ?? net.connection.name,
      route: getEscapedTraceRoute(
        { ...pair, path: this.search.path },
        this.copper,
      ),
    }
    this.routes.push(trace)
    this.updateRoutingStats()
    this.pairIndex++
    if (this.pairIndex < this.pairs.length) return
    for (const trace of this.routes.slice(-this.pairs.length)) {
      this.copper.markRoute(trace.route, pair.start.owner)
    }
    this.pairIndex = 0
    this.pairs = []
    this.netIndex++
  }

  /** Shorter nets route first and may close every path of a longer net. That
   * net is then routed first on copper holding only the fixed board and the
   * reserved escapes, and the others follow it again. Each net is promoted
   * once, so the restarts end; a promoted net that finds no path fails. */
  private restartWithNetFirst(net: Net): boolean {
    if (this.netIndex === 0 || this.promotedNets.has(net)) return false
    this.promotedNets.add(net)
    this.nets.splice(this.netIndex, 1)
    this.nets.unshift(net)
    this.copper = new BgaRoutingCopper(this.copper.grid, this.input.board)
    for (const escape of this.escapes.values()) {
      this.copper.markRoute(
        getReservedEscapeRoute(escape, this.copper),
        escape.owner,
      )
    }
    this.search = new BgaTrackSearch(this.copper)
    this.routes.length = 0
    this.netIndex = 0
    this.pairIndex = 0
    this.pairs = []
    this.updateRoutingStats()
    return true
  }

  private planNextTerminal(): void {
    const terminal = this.terminals[this.terminalIndex]!
    const countSites = this.stage === "count_escape_sites"
    const sites = findTerminalEscape({ terminal, countSites }, this.copper)
    if (!sites.count) {
      this.failure = "no_via_site"
      this.error = `No clear through-via escape for ${terminal.terminalId}`
      this.failed = true
      return
    }
    if (countSites) {
      this.sites.set(terminal, sites)
    } else {
      const escaped = { ...terminal, ...sites.escape! }
      this.escapes.set(terminal, escaped)
      this.copper.markRoute(
        getReservedEscapeRoute(escaped, this.copper),
        terminal.owner,
      )
    }
    this.terminalIndex++
    if (this.terminalIndex < this.terminals.length) return
    this.terminalIndex = 0
    if (countSites) {
      this.terminals.sort((a, b) => {
        const first = this.sites.get(a)!
        const second = this.sites.get(b)!
        const byScarcity =
          first.count - second.count || second.distance - first.distance
        if (byScarcity || a.terminalId === b.terminalId) return byScarcity
        return a.terminalId < b.terminalId ? -1 : 1
      })
      this.stage = "reserve_escapes"
    } else {
      this.stage = "route_connections"
    }
  }

  override getOutput(): BgaTrace[] {
    if (!this.solved) throw new Error("BGA escape routing has not completed")
    return this.routes
  }

  override getConstructorParams(): [BgaEscapeRoutingSolverInput] {
    return [this.input]
  }

  computeProgress(): number {
    if (this.solved) return 1
    const total = 2 * this.terminals.length + this.input.pointPairs.length
    return total
      ? (this.sites.size + this.escapes.size + this.routes.length) / total
      : 0
  }

  override visualize(): GraphicsObject {
    return getBgaRoutingGraphics({
      board: this.input.board,
      countedTerminals: this.stage === "route_connections" ? [] : this.sites,
      reservedEscapes: this.solved
        ? []
        : Array.from(this.escapes.values(), (escape) => ({
            terminalId: escape.terminalId,
            route: getReservedEscapeRoute(escape, this.copper),
          })),
      routes: this.routes,
    })
  }
}
