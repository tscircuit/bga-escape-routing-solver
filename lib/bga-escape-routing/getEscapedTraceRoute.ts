import type { BgaTrace } from "./types"
import { getLayerName } from "./routingLayers"
import type { BgaRoutingCopper } from "./BgaRoutingCopper"
import type { RoutingTerminal, TerminalEscape } from "./findTerminalEscape"

export type EscapedTerminal = RoutingTerminal & TerminalEscape
export type TerminalPair = {
  start: EscapedTerminal
  end: EscapedTerminal
  connectionName: string
}

type Route = BgaTrace["route"]
type RouteContext = {
  width: number
  copper: BgaRoutingCopper
  widthByCell?: Map<number, number>
}

function getWireAndViaRoute(
  cells: number[],
  { width, copper, widthByCell }: RouteContext,
): Route {
  const { grid } = copper
  const vertices = cells.filter(
    (cell, index) => !index || cell !== cells[index - 1],
  )
  const corners = vertices.filter((cell, index) => {
    if (!index || index === vertices.length - 1) return true
    return (
      cell - vertices[index - 1]! !== vertices[index + 1]! - cell ||
      (widthByCell?.get(cell) ?? width) !==
        (widthByCell?.get(vertices[index - 1]!) ?? width)
    )
  })
  const route: Route = []
  for (const [index, cell] of corners.entries()) {
    const layer = getLayerName(
      Math.floor(cell / grid.layerSize),
      grid.layerCount,
    )
    const point = grid.getPoint(cell)
    const previous = corners[index - 1]
    if (previous !== undefined) {
      const previousLayer = getLayerName(
        Math.floor(previous / grid.layerSize),
        grid.layerCount,
      )
      if (previousLayer !== layer) {
        route.push({
          route_type: "via",
          ...point,
          from_layer: previousLayer,
          to_layer: layer,
          via_diameter: copper.via.padDiameter,
          via_hole_diameter: copper.via.holeDiameter,
        })
      }
    }
    route.push({
      route_type: "wire",
      ...point,
      layer,
      width: widthByCell?.get(cell) ?? width,
    })
  }
  return route
}

export function getReservedEscapeRoute(
  terminal: EscapedTerminal,
  copper: BgaRoutingCopper,
): Route {
  const { point, path, width, viaSite } = terminal
  if (terminal.existingVia)
    return [
      { route_type: "wire", x: point.x, y: point.y, width, layer: point.layer },
    ]
  const { innerSignalLayers } = copper.grid
  const targetLayer =
    point.layer === "top" ? innerSignalLayers[0]! : innerSignalLayers.at(-1)!
  const viaCell = targetLayer * copper.grid.layerSize + viaSite
  const route = getWireAndViaRoute([...path, viaCell], {
    width: terminal.escapeWidth ?? width,
    copper,
  })
  route.unshift({
    route_type: "wire",
    x: point.x,
    y: point.y,
    width: terminal.escapeWidth ?? width,
    layer: point.layer,
  })
  return route
}

export function getEscapedTraceRoute(
  branch: TerminalPair & { path: number[] },
  copper: BgaRoutingCopper,
): Route {
  const { start, end, path } = branch
  const { layerSize } = copper.grid
  // Connect each surface approach directly to the trunk's actual layer.
  // Starting the search on an inner layer must not introduce a second drill.
  const firstSite = path[0]! % layerSize
  const lastSite = path[path.length - 1]! % layerSize
  const skipStart = path.length > 1 && firstSite === path[1]! % layerSize
  const skipEnd =
    path.length > 1 && lastSite === path[path.length - 2]! % layerSize
  const trunk = path.slice(skipStart ? 1 : 0, skipEnd ? -1 : undefined)
  const cells = [...start.path, ...trunk, ...end.path.toReversed()]
  const widthByCell = new Map<number, number>()
  for (const terminal of [start, end])
    for (const cell of terminal.path)
      widthByCell.set(cell, terminal.escapeWidth ?? terminal.width)
  const route = getWireAndViaRoute(cells, {
    width: start.width,
    copper,
    widthByCell,
  })
  for (const point of route)
    for (const terminal of [start, end])
      if (terminal.existingVia) {
        const site = copper.grid.getPoint(terminal.viaSite)
        if (Math.hypot(point.x - site.x, point.y - site.y) < 1e-8) {
          point.x = terminal.point.x
          point.y = terminal.point.y
        }
      }
  const first = route[0]
  const last = route[route.length - 1]
  if (first?.route_type !== "wire" || last?.route_type !== "wire") {
    throw new Error("BGA track must begin and end on terminal copper")
  }

  const startWire = {
    route_type: "wire" as const,
    x: start.point.x,
    y: start.point.y,
    width: start.escapeWidth ?? start.width,
    layer: start.point.layer,
    start_pcb_port_id: start.point.pcb_port_id,
  }
  const endWire = {
    route_type: "wire" as const,
    x: end.point.x,
    y: end.point.y,
    width: end.escapeWidth ?? end.width,
    layer: end.point.layer,
    end_pcb_port_id: end.point.pcb_port_id,
  }
  if (Math.hypot(first.x - startWire.x, first.y - startWire.y) > 1e-9)
    route.unshift(startWire)
  else Object.assign(first, startWire)
  if (Math.hypot(last.x - endWire.x, last.y - endWire.y) > 1e-9)
    route.push(endWire)
  else Object.assign(last, endWire)
  return route
}
