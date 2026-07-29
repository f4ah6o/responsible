import { HIERARCHICAL_BOUNDARY_ORDER } from "../index.js";
import {
  boundaryIdForPath,
  decodeBoundaryId,
  displayBoundaryValue,
  formatBoundaryValue,
  type DecodedBoundaryPart,
} from "../boundary.js";
import type { ActivityDef, Id, ProcessView, ProjectedActivity } from "../model.js";

export type HierarchicalLane = {
  id: string;
  label: string;
  boundaryKey: string;
  depth: number;
  children: HierarchicalLane[];
  activities: ProjectedActivity[];
};

export type LaneHierarchy = {
  roots: HierarchicalLane[];
  activityParentId: Map<Id, string>;
  activityFlowIndex: Map<Id, number>;
  laneIdByBoundary: Map<string, string>;
};

/**
 * Parse a composite boundary string like "company:X|department:Y|team:Z"
 * into an array of values ["X", "Y", "Z"].
 * For a single-key boundary like "team_name", returns ["team_name"].
 */
function boundaryParts(
  boundaryStr: string,
  pathKeys: readonly string[],
): readonly DecodedBoundaryPart[] {
  // A one-axis expression has no composite separator to parse. This branch
  // keeps literal values such as "A|B" and "D:C" intact.
  if (pathKeys.length === 1 && !boundaryStr.startsWith("\u0001")) {
    return pathKeys[0] === undefined
      ? [{ value: boundaryStr }]
      : [{ key: pathKeys[0], value: boundaryStr }];
  }
  const decoded = decodeBoundaryId(boundaryStr);
  const first = decoded[0];
  if (decoded.length === 1 && first !== undefined && first.key === undefined) {
    return pathKeys[0] === undefined
      ? [{ value: first.value }]
      : [{ key: pathKeys[0], value: first.value }];
  }
  return decoded.map((part, index) => {
    const key = part.key ?? pathKeys[index];
    return key === undefined ? { value: part.value } : { key, value: part.value };
  });
}

/**
 * The deepest lane node id a boundary id falls into, matching the ids built
 * by `buildLaneHierarchy`. Used to anchor directed-effect edges to the lane
 * of their resolved target boundary.
 */
export function laneIdForBoundary(boundaryStr: string, pathKeys: readonly string[]): string {
  const parts = boundaryParts(boundaryStr, pathKeys);
  const values = parts.slice(0, pathKeys.length);
  const hasUnsafeLegacyValue = values.some(
    ({ key, value }) =>
      !key ||
      key.includes(":") ||
      key.includes("|") ||
      key.includes("/") ||
      typeof value !== "string" ||
      value.includes(":") ||
      value.includes("|") ||
      value.includes("/"),
  );
  if (!hasUnsafeLegacyValue) {
    return `lane:${values.map(({ key, value }) => `${key}:${value}`).join("/")}`;
  }
  return `lane:v2:${encodeURIComponent(boundaryIdForPath(values))}`;
}

/** Canonical identity used to look up the actual lane node for an axis path. */
export function laneBoundaryIdentity(boundaryStr: string, pathKeys: readonly string[]): string {
  const parts = boundaryParts(boundaryStr, pathKeys).slice(0, pathKeys.length);
  return parts.length === 1 ? formatBoundaryValue(parts[0]?.value) : boundaryIdForPath(parts);
}

export function buildLaneHierarchy(
  view: ProcessView,
  _activities: Readonly<Record<Id, ActivityDef>>,
  zoomLevel: number,
): LaneHierarchy {
  const pathKeys = HIERARCHICAL_BOUNDARY_ORDER.slice(0, zoomLevel + 1);

  const roots: HierarchicalLane[] = [];
  const laneById = new Map<string, HierarchicalLane>();
  const activityParentId = new Map<Id, string>();
  const activityFlowIndex = new Map<Id, number>();
  const activityIds = new Set(view.activities.map((activity) => activity.id));
  const occupiedNodeIds = new Set(activityIds);
  const laneIdByBoundary = new Map<string, string>();

  for (const [flowIndex, activity] of view.activities.entries()) {
    activityFlowIndex.set(activity.id, flowIndex);

    const parts = boundaryParts(activity.boundary, pathKeys);
    const pathValues = parts.map(({ value }) => displayBoundaryValue(value));

    let currentChildren = roots;

    for (let depth = 0; depth < pathKeys.length; depth++) {
      const key = pathKeys[depth]!;
      const value = pathValues[depth] ?? "<unassigned>";

      const laneParts = parts.slice(0, depth + 1);
      const boundaryId =
        laneParts.length === 1
          ? formatBoundaryValue(laneParts[0]?.value)
          : boundaryIdForPath(laneParts);
      let laneId = laneIdByBoundary.get(boundaryId);
      if (laneId === undefined) {
        laneId = laneIdForBoundary(boundaryId, pathKeys.slice(0, depth + 1));
        if (occupiedNodeIds.has(laneId)) {
          const encoded = `lane:v2:${encodeURIComponent(boundaryIdForPath(laneParts))}`;
          laneId = encoded;
          let suffix = 1;
          while (occupiedNodeIds.has(laneId)) {
            laneId = `${encoded}~${suffix}`;
            suffix += 1;
          }
        }
        occupiedNodeIds.add(laneId);
        laneIdByBoundary.set(boundaryId, laneId);
      }

      let lane = laneById.get(laneId);
      if (!lane) {
        lane = {
          id: laneId,
          label: value,
          boundaryKey: key,
          depth,
          children: [],
          activities: [],
        };
        laneById.set(laneId, lane);
        currentChildren.push(lane);
      }

      if (depth === pathKeys.length - 1) {
        lane.activities.push(activity);
        activityParentId.set(activity.id, laneId);
      }

      currentChildren = lane.children;
    }
  }

  return { roots, activityParentId, activityFlowIndex, laneIdByBoundary };
}
