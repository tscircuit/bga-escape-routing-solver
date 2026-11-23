import type { Circle, GraphicsObject, Line, Rect } from "graphics-debug"
import type { EscapeSites, RoutingTerminal } from "./findTerminalEscape"
import { getLayerIndex } from "./routingLayers"
import type { BgaRoutingBoard, BgaTerminalId, BgaTrace } from "./types"

type LabeledRoute = { label: string; route: BgaTrace["route"]; color: string }
type RoutingGraphicsInput = {
  board: BgaRoutingBoard
  countedTerminals: Iterable<[RoutingTerminal, EscapeSites]>
  reservedEscapes: { terminalId: BgaTerminalId; route: BgaTrace["route"] }[]
  routes: BgaTrace[]
}
type RouteGraphicsContext = {
  board: BgaRoutingBoard
  throughLayers: string
  circles: Circle[]
  lines: Line[]
}

/** Board-world points in mm: +X right, +Y up, right-handed with +Z above. */
export function getBgaRoutingGraphics({
  board,
  countedTerminals,
  reservedEscapes,
  routes,
}: RoutingGraphicsInput): GraphicsObject {
  const rects: Rect[] = []
  const circles: Circle[] = []
  const lines: Line[] = []
  const throughLayers =
    "z" + Array.from({ length: board.layerCount }, (_, z) => z).join(",")
  for (const pad of board.obstacles) {
    const style = {
      center: pad.center,
      fill: "#e6d4d4",
      layer:
        "z" +
        pad.layers
          .map((layer) => getLayerIndex(layer, board.layerCount))
          .join(","),
      label: pad.connectedTo.join(", "),
    }
    if (pad.shape === "circle")
      circles.push({ ...style, radius: pad.width / 2 })
    else
      rects.push({
        ...style,
        width: pad.width,
        height: pad.height,
        ccwRotationDegrees: pad.ccwRotationDegrees,
      })
  }

  const routeGraphics = { board, throughLayers, circles, lines }

  for (const trace of board.fixedTraces) {
    appendRouteGraphics(
      { route: trace.route, label: trace.connection_name, color: "#64748b" },
      routeGraphics,
    )
  }
  for (const escape of reservedEscapes) {
    appendRouteGraphics(
      {
        route: escape.route,
        label: escape.terminalId + " reserved escape",
        color: "#c0690c",
      },
      routeGraphics,
    )
  }
  for (const trace of routes) {
    appendRouteGraphics(
      { route: trace.route, label: trace.connection_name, color: "#2157a2" },
      routeGraphics,
    )
  }

  const points = Array.from(countedTerminals, ([terminal, sites]) => ({
    x: terminal.point.x,
    y: terminal.point.y,
    layer: "z" + getLayerIndex(terminal.point.layer, board.layerCount),
    color: "#6c408a",
    label: `${terminal.terminalId}: ${sites.count} via sites`,
  }))
  return { coordinateSystem: "cartesian", rects, circles, lines, points }
}

function appendRouteGraphics(
  { label, route, color }: LabeledRoute,
  { board, throughLayers, circles, lines }: RouteGraphicsContext,
): void {
  for (const [index, point] of route.entries()) {
    if (point.route_type === "via") {
      circles.push({
        center: point,
        radius: (point.via_diameter ?? board.via.padDiameter) / 2,
        fill: color,
        layer: throughLayers,
        label,
      })
      circles.push({
        center: point,
        radius: (point.via_hole_diameter ?? board.via.holeDiameter) / 2,
        fill: "white",
        layer: throughLayers,
        label,
      })
      continue
    }
    const next = route[index + 1]
    if (next?.route_type !== "wire" || point.layer !== next.layer) continue
    if (point.x === next.x && point.y === next.y) continue
    let strokeDash: Line["strokeDash"]
    if (point.layer !== "top") strokeDash = [point.width * 3, point.width]
    lines.push({
      points: [point, next],
      strokeColor: color,
      strokeWidth: point.width,
      strokeDash,
      layer: "z" + getLayerIndex(point.layer, board.layerCount),
      label,
    })
  }
}
