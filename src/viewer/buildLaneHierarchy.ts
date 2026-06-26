import { HIERARCHICAL_BOUNDARY_ORDER } from "../index.js";
import { resolveBoundaryValue, formatBoundaryValue } from "../boundary.js";
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
};

function sourceIdsOf(activity: ProjectedActivity): readonly Id[] {
  return activity.kind === "atomic" ? [activity.activityId] : activity.activityIds;
}

export function buildLaneHierarchy(
  view: ProcessView,
  activities: Readonly<Record<Id, ActivityDef>>,
  zoomLevel: number,
): LaneHierarchy {
  const leafKey = HIERARCHICAL_BOUNDARY_ORDER[zoomLevel] ?? HIERARCHICAL_BOUNDARY_ORDER[0]!;
  const ancestorKeys = HIERARCHICAL_BOUNDARY_ORDER.slice(0, zoomLevel);

  const roots: HierarchicalLane[] = [];
  const laneById = new Map<string, HierarchicalLane>();
  const activityParentId = new Map<Id, string>();

  for (const activity of view.activities) {
    const sourceId = sourceIdsOf(activity)[0];
    if (!sourceId) continue;
    const sourceDef = activities[sourceId];
    if (!sourceDef) continue;

    const pathKeys = [...ancestorKeys, leafKey];
    const pathValues = pathKeys.map((key) =>
      formatBoundaryValue(resolveBoundaryValue(sourceDef, key)),
    );

    let currentChildren = roots;
    let parentLane: HierarchicalLane | undefined;

    for (let depth = 0; depth < pathKeys.length; depth++) {
      const key = pathKeys[depth]!;
      const value = pathValues[depth]!;

      const segments = pathValues.slice(0, depth + 1);
      const laneId = `lane:${pathKeys.slice(0, depth + 1).map((k, i) => `${k}:${segments[i]}`).join("/")}`;

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
      parentLane = lane;
    }

    void parentLane;
  }

  return { roots, activityParentId };
}
