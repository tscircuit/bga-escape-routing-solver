import type { Circle, GraphicsObject, Line, Rect } from "graphics-debug"
import type { EscapeSites, RoutingTerminal } from "./findTerminalEscape"
import { getLayerIndex } from "./routingLayers"
import type { BgaRoutingBoard, BgaTrace } from "./types"

type LabeledRoute = { label: string; route: BgaTrace["route"]; color: string }
type RoutingGraphicsInput = {
  board: BgaRoutingBoard
  countedTerminals: Iterable<[RoutingTerminal, EscapeSites]>
  reservedEscapes: { terminalId: string; route: BgaTrace["route"] }[]
  routes: BgaTrace[]
}

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

  const drawRoute = ({ label, route, color }: LabeledRoute): void => {
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
      lines.push({
        points: [point, next],
        strokeColor: color,
        strokeWidth: point.width,
        strokeDash:
          point.layer === "top" ? undefined : [point.width * 3, point.width],
        layer: "z" + getLayerIndex(point.layer, board.layerCount),
        label,
      })
    }
  }

  for (const trace of board.fixedTraces) {
    drawRoute({
      route: trace.route,
      label: trace.connection_name,
      color: "#64748b",
    })
  }
  for (const escape of reservedEscapes) {
    drawRoute({
      route: escape.route,
      label: escape.terminalId + " reserved escape",
      color: "#c0690c",
    })
  }
  for (const trace of routes) {
    drawRoute({
      route: trace.route,
      label: trace.connection_name,
      color: "#2157a2",
    })
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
