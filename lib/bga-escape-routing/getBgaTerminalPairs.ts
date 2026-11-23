import type { BgaConnection, BgaConnectionName, BgaTerminalId } from "./types"
import type { BgaRoutingGrid } from "./BgaRoutingGrid"
import type { TerminalPair } from "./bgaTraceRoutes"
import type { RoutingTerminal } from "./findTerminalEscape"

type PairingTerminal = RoutingTerminal & { viaSite?: number }

type PairingInput<T extends PairingTerminal> = {
  terminals: T[]
  pointPairs: BgaConnection[]
}

/** Orient the given point pairs away from their first terminal, shortest available branch first. */
export function getBgaTerminalPairs<T extends PairingTerminal>(
  { terminals, pointPairs }: PairingInput<T>,
  grid: BgaRoutingGrid,
): TerminalPair<T>[] | undefined {
  if (!terminals.length || pointPairs.length !== terminals.length - 1) return
  const pairByTerminal = new Map<
    BgaTerminalId,
    Map<BgaTerminalId, BgaConnectionName>
  >()
  for (const pair of pointPairs) {
    const [first, second] = pair.pointsToConnect
    const start = first?.pcb_port_id ?? first?.pointId
    const end = second?.pcb_port_id ?? second?.pointId
    if (!start || !end || pair.pointsToConnect.length !== 2) return
    if (!pairByTerminal.has(start)) pairByTerminal.set(start, new Map())
    if (!pairByTerminal.has(end)) pairByTerminal.set(end, new Map())
    pairByTerminal.get(start)!.set(end, pair.name)
    pairByTerminal.get(end)!.set(start, pair.name)
  }
  const routed = new Set([terminals[0]!])
  const branches: TerminalPair<T>[] = []
  while (routed.size < terminals.length) {
    let shortest = Infinity
    let next: TerminalPair<T> | undefined
    for (const start of routed) {
      const first = grid.getPoint(start.viaSite ?? start.cell)
      for (const end of terminals) {
        if (routed.has(end)) continue
        const connectionName = pairByTerminal
          .get(start.terminalId)
          ?.get(end.terminalId)
        if (!connectionName) continue
        const last = grid.getPoint(end.viaSite ?? end.cell)
        const distance = Math.hypot(first.x - last.x, first.y - last.y)
        if (distance >= shortest) continue
        next = { start, end, connectionName }
        shortest = distance
      }
    }
    if (!next) return
    branches.push(next)
    routed.add(next.end)
  }
  return branches
}
