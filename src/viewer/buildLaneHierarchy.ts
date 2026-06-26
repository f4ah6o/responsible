import { HIERARCHICAL_BOUNDARY_ORDER } from "../index.js";
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
};

/**
 * Parse a composite boundary string like "company:X|department:Y|team:Z"
 * into an array of values ["X", "Y", "Z"].
 * For a single-key boundary like "team_name", returns ["team_name"].
 */
function parseBoundaryPath(boundaryStr: string): string[] {
  if (!boundaryStr.includes("|")) return [boundaryStr];
  return boundaryStr.split("|").map((part) => {
    const idx = part.indexOf(":");
    return idx >= 0 ? part.slice(idx + 1) : part;
  });
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

  for (const [flowIndex, activity] of view.activities.entries()) {
    activityFlowIndex.set(activity.id, flowIndex);

    const pathValues = parseBoundaryPath(activity.boundary);

    let currentChildren = roots;

    for (let depth = 0; depth < pathKeys.length; depth++) {
      const key = pathKeys[depth]!;
      const value = pathValues[depth] ?? "<unassigned>";

      const segments = pathValues.slice(0, depth + 1);
      const laneId = `lane:${pathKeys
        .slice(0, depth + 1)
        .map((k, i) => `${k}:${segments[i]}`)
        .join("/")}`;

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

  return { roots, activityParentId, activityFlowIndex };
}
