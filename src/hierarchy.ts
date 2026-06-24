import type { BoundaryExpr } from "./model.js";

/**
 * Hierarchical responsibility boundary order, from the most coarse level
 * (zoomed out) to the most detailed level (zoomed in).
 *
 * Zoom in the responsibility-boundary sense means choosing a different level
 * in this order; it does not mean moving along the Activity decomposition
 * (`children`) hierarchy.
 */
export const HIERARCHICAL_BOUNDARY_ORDER = [
  "company",
  "department",
  "section",
  "team",
  "person",
] as const;

export type HierarchicalBoundaryKey = (typeof HIERARCHICAL_BOUNDARY_ORDER)[number];

export function isHierarchicalBoundary(boundary: BoundaryExpr): boolean {
  if (typeof boundary !== "string") return false;
  return (HIERARCHICAL_BOUNDARY_ORDER as readonly string[]).includes(boundary);
}

/**
 * Returns the zoom-level index for a boundary expression, or `null` when the
 * boundary is not one of the hierarchical levels (e.g. `function`, `role`,
 * `system`, or a composite boundary such as `[project, function]`).
 */
export function zoomLevelIndexOf(boundary: BoundaryExpr): number | null {
  if (typeof boundary !== "string") return null;
  const idx = HIERARCHICAL_BOUNDARY_ORDER.indexOf(boundary as HierarchicalBoundaryKey);
  return idx === -1 ? null : idx;
}

export function boundaryForLevel(level: number): BoundaryExpr {
  const clamped = clampZoomLevel(level);
  return HIERARCHICAL_BOUNDARY_ORDER[clamped]!;
}

export function zoomIn(level: number): number {
  return clampZoomLevel(level + 1);
}

export function zoomOut(level: number): number {
  return clampZoomLevel(level - 1);
}

export function canZoomIn(level: number): boolean {
  return level < HIERARCHICAL_BOUNDARY_ORDER.length - 1;
}

export function canZoomOut(level: number): boolean {
  return level > 0;
}

export function clampZoomLevel(level: number): number {
  if (level < 0) return 0;
  if (level > HIERARCHICAL_BOUNDARY_ORDER.length - 1) {
    return HIERARCHICAL_BOUNDARY_ORDER.length - 1;
  }
  return level;
}

export const ZOOM_LEVEL_COUNT = HIERARCHICAL_BOUNDARY_ORDER.length;
