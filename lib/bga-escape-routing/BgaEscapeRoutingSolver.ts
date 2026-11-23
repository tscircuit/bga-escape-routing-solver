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
type RoutingContext = {
  copper: BgaRoutingCopper
  nets: Net[]
  terminals: RoutingTerminal[]
}

type PreparedEscapes = {
  context: RoutingContext
  sites: Map<RoutingTerminal, EscapeSites>
  escapes: Map<RoutingTerminal, EscapedTerminal>
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
  private preparedEscapes?: PreparedEscapes
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
    }
  }

  /** Prepare the required local through-via escapes before selecting this strategy.
   * Missing local access is unsupported input; unexpected errors still propagate. */
  static createIfApplicable(
    input: BgaEscapeRoutingSolverInput,
  ): BgaEscapeRoutingSolver | undefined {
    return this.createPreparedCandidate(input).solver
  }

  /** Prepare a complete local assignment through the existing escape search.
   * An unsuccessful candidate never commits copper or selects another router. */
  static prepareLocalSourceEscapes(
    input: BgaEscapeRoutingSolverInput,
    maximumOrderAttempts = 64,
  ): BgaEscapeRoutingSolver | undefined {
    if (!Number.isSafeInteger(maximumOrderAttempts) || maximumOrderAttempts < 1)
      throw Error("Invalid native local escape order budget")
    const terminalOrderBias: string[] = []
    for (let attempt = 0; attempt < maximumOrderAttempts; attempt++) {
      const result = this.createPreparedCandidate({
        ...input,
        terminalOrderBias,
      })
      if (result.solver) return result.solver
      if (result.initiallyBlocked || !result.blockedTerminalId) return
      terminalOrderBias.push(result.blockedTerminalId)
    }
  }

  private static createPreparedCandidate(input: BgaEscapeRoutingSolverInput): {
    solver?: BgaEscapeRoutingSolver
    blockedTerminalId?: string
    initiallyBlocked?: boolean
  } {
    const context = BgaEscapeRoutingSolver.createRoutingContext(input)
    if ("failure" in context) return {}
    const sites = new Map<RoutingTerminal, EscapeSites>()
    for (const terminal of context.terminals) {
      const available = findTerminalEscape(
        { terminal, countSites: true },
        context.copper,
      )
      if (!available.count)
        return {
          blockedTerminalId: terminal.terminalId,
          initiallyBlocked: true,
        }
      sites.set(terminal, available)
    }
    BgaEscapeRoutingSolver.sortByEscapeScarcity(context.terminals, sites)
    const escapes = new Map<RoutingTerminal, EscapedTerminal>()
    if (input.terminalOrderBias !== undefined) {
      const pending = [...context.terminals]
      while (pending.length) {
        const current = new Map<RoutingTerminal, EscapeSites>()
        for (const terminal of pending) {
          const available = findTerminalEscape(
            { terminal, countSites: true },
            context.copper,
          )
          if (!available.count)
            return { blockedTerminalId: terminal.terminalId }
          current.set(terminal, available)
        }
        BgaEscapeRoutingSolver.sortByEscapeScarcity(pending, current)
        const priority = new Map(
          (input.terminalOrderBias ?? []).map((id, index) => [id, index + 1]),
        )
        pending.sort(
          (a, b) =>
            (priority.get(b.terminalId) ?? 0) -
            (priority.get(a.terminalId) ?? 0),
        )
        const terminal = pending.shift()!,
          available = findTerminalEscape(
            { terminal, countSites: false },
            context.copper,
          )
        if (!available.count)
          throw Error("Native local escape changed without a reservation")
        const escaped = BgaEscapeRoutingSolver.reserveEscape(
          { terminal, sites: available },
          context.copper,
        )
        escapes.set(terminal, escaped)
      }
    } else {
      for (const terminal of context.terminals) {
        const available = findTerminalEscape(
          { terminal, countSites: false },
          context.copper,
        )
        if (!available.count) return { blockedTerminalId: terminal.terminalId }
        escapes.set(
          terminal,
          BgaEscapeRoutingSolver.reserveEscape(
            { terminal, sites: available },
            context.copper,
          ),
        )
      }
    }
    const solver = new BgaEscapeRoutingSolver(input)
    solver.preparedEscapes = { context, sites, escapes }
    return { solver }
  }

  private static createRoutingContext(
    input: BgaEscapeRoutingSolverInput,
  ): RoutingContext | { failure: RoutingFailure; error: string } {
    const { board } = input
    const grid = new BgaRoutingGrid(input)
    if (!grid.fitsMemoryBudget()) {
      const dimensions = [grid.columns, grid.rows, grid.layerCount].join(" × ")
      return {
        failure: "grid_budget",
        error: `BGA grid exceeds the available routing area or memory budget (${dimensions})`,
      }
    }
    const nets: Net[] = []
    const terminals: RoutingTerminal[] = []
    for (const [index, connection] of board.connections.entries()) {
      let span = 0
      const width = grid.widthByConnectionName.get(connection.name)!
      const netTerminals: RoutingTerminal[] = []
      for (const [pointIndex, point] of connection.pointsToConnect.entries()) {
        const terminalId = point.pcb_port_id ?? point.pointId
        const layer = point.layer
        const existingVia = !!(
          board.reuseFixedCopper &&
          board.fixedTraces.some(
            (trace) =>
              trace.connection_name === connection.name &&
              trace.route.some(
                (via) =>
                  via.route_type === "via" &&
                  Math.hypot(via.x - point.x, via.y - point.y) < 1e-8 &&
                  (via.layers ?? []).includes(layer ?? "") &&
                  input.signalLayers.every((z) =>
                    (via.layers ?? []).includes(
                      z === 0
                        ? "top"
                        : z === board.layerCount - 1
                          ? "bottom"
                          : `inner${z}`,
                    ),
                  ),
              ),
          )
        )
        if (
          !terminalId ||
          layer === undefined ||
          (!existingVia && point.layer !== "top" && point.layer !== "bottom")
        ) {
          throw new Error(
            `Expected a surface pad terminal for ${connection.name}`,
          )
        }
        const z = getLayerIndex(layer, board.layerCount)
        const cell = grid.getCell(point, z)
        if (cell === undefined) {
          return {
            failure: "terminal_outside_grid",
            error: `BGA terminal ${terminalId} is outside the board-edge routing margin`,
          }
        }
        const previous = connection.pointsToConnect[pointIndex - 1]
        if (previous)
          span += Math.hypot(point.x - previous.x, point.y - previous.y)
        netTerminals.push({
          existingVia,
          escapeWidth: existingVia ? undefined : connection.escapeWidth,
          point: { ...point, layer },
          owner: index + 1,
          width,
          terminalId,
          cell,
        })
      }
      const pointPairs = input.pointPairs.filter(
        (pair) =>
          pair.name === connection.name ||
          pair.rootConnectionName === connection.name ||
          pair.__rootConnectionNames?.includes(connection.name),
      )
      nets.push({ connection, pointPairs, terminals: netTerminals, span })
      terminals.push(...netTerminals)
    }
    nets.sort((a, b) => a.span - b.span)
    return { copper: new BgaRoutingCopper(grid, board), nets, terminals }
  }

  private static sortByEscapeScarcity(
    terminals: RoutingTerminal[],
    sites: ReadonlyMap<RoutingTerminal, EscapeSites>,
  ): void {
    terminals.sort((a, b) => {
      const first = sites.get(a)!
      const second = sites.get(b)!
      const byScarcity =
        first.count - second.count || second.distance - first.distance
      if (byScarcity || a.terminalId === b.terminalId) return byScarcity
      return a.terminalId < b.terminalId ? -1 : 1
    })
  }

  private static reserveEscape(
    { terminal, sites }: { terminal: RoutingTerminal; sites: EscapeSites },
    copper: BgaRoutingCopper,
  ): EscapedTerminal {
    const escaped = { ...terminal, ...sites.escape! }
    copper.markRoute(getReservedEscapeRoute(escaped, copper), terminal.owner)
    return escaped
  }

  override _setup(): void {
    const context =
      this.preparedEscapes?.context ??
      BgaEscapeRoutingSolver.createRoutingContext(this.input)
    if ("failure" in context) {
      this.failure = context.failure
      this.error = context.error
      this.failed = true
      return
    }
    this.copper = context.copper
    this.nets = context.nets
    this.terminals = context.terminals
    this.search = new BgaTrackSearch(this.copper)
    if (this.preparedEscapes) {
      for (const [terminal, sites] of this.preparedEscapes.sites)
        this.sites.set(terminal, sites)
      for (const [terminal, escape] of this.preparedEscapes.escapes)
        this.escapes.set(terminal, escape)
      this.stage = "route_connections"
    }
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
      const escaped = BgaEscapeRoutingSolver.reserveEscape(
        { terminal, sites },
        this.copper,
      )
      this.escapes.set(terminal, escaped)
    }
    this.terminalIndex++
    if (this.terminalIndex < this.terminals.length) return
    this.terminalIndex = 0
    if (countSites) {
      BgaEscapeRoutingSolver.sortByEscapeScarcity(this.terminals, this.sites)
      this.stage = "reserve_escapes"
    } else {
      this.stage = "route_connections"
    }
  }

  getPreparedEscapeTraces(): {
    terminalId: string
    route: BgaTrace["route"]
  }[] {
    if (!this.preparedEscapes)
      throw Error("Local BGA escapes were not prepared")
    return [...this.preparedEscapes.escapes.values()].map((terminal) => ({
      terminalId: terminal.terminalId,
      route: getReservedEscapeRoute(
        terminal,
        this.preparedEscapes!.context.copper,
      ),
    }))
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
