export function getLayerIndex(layer: string, layerCount: number): number {
  if (layer === "top") return 0
  if (layer === "bottom") return layerCount - 1
  const index = /^inner(\d+)$/.exec(layer)
  if (!index) {
    throw new Error(
      `Invalid layer name "${layer}" for a ${layerCount}-layer board`,
    )
  }
  const z = Number.parseInt(index[1]!, 10)
  if (z < 1 || z >= layerCount - 1) {
    throw new Error(`Invalid layer "${layer}" for a ${layerCount}-layer board`)
  }
  return z
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
