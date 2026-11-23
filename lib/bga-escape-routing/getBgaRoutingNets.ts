import type { BgaConnection, BgaRoutingSolverInput } from "./types"
import type { RoutingTerminal } from "./findTerminalEscape"
import type { BgaRoutingGrid } from "./BgaRoutingGrid"
import { getLayerIndex } from "./routingLayers"

export type BgaRoutingNet = {
  connection: BgaConnection
  pointPairs: BgaConnection[]
  terminals: RoutingTerminal[]
  span: number
}

export function getBgaRoutingNets(
  input: BgaRoutingSolverInput,
  grid: BgaRoutingGrid,
): { nets: BgaRoutingNet[] } | { error: string } {
  const { board } = input
  const nets: BgaRoutingNet[] = []
  for (const [index, connection] of board.connections.entries()) {
    let span = 0
    const width = grid.widthByConnectionName.get(connection.name)!
    const terminals: RoutingTerminal[] = []
    for (const [pointIndex, point] of connection.pointsToConnect.entries()) {
      const terminalId = point.pcb_port_id ?? point.pointId
      if (!terminalId || (point.layer !== "top" && point.layer !== "bottom")) {
        throw new Error(
          `Expected a surface pad terminal for ${connection.name}`,
        )
      }
      const z = getLayerIndex(point.layer, board.layerCount)
      const cell = grid.getCell(point, z)
      if (cell === undefined) {
        return {
          error: `BGA terminal ${terminalId} is outside the board-edge routing margin`,
        }
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
    const pointPairs = input.pointPairs.filter(
      (pair) =>
        pair.name === connection.name ||
        pair.rootConnectionName === connection.name ||
        pair.__rootConnectionNames?.includes(connection.name),
    )
    nets.push({ connection, pointPairs, terminals, span })
  }
  return { nets }
}
