export function getLayerIndex(layer: string, layerCount: number): number {
  if (layer === "top") return 0
  if (layer === "bottom") return layerCount - 1
  return Number.parseInt(layer.slice(5), 10)
}

export function getLayerName(index: number, layerCount: number): string {
  if (index < 0 || index >= layerCount) {
    throw new Error(
      `Invalid layer index ${index} for a ${layerCount}-layer board`,
    )
  }
  if (index === 0) return "top"
  if (index === layerCount - 1) return "bottom"
  return `inner${index}`
}
