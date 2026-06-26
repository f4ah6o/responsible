import { MarkerType, type Edge, type Node } from "@xyflow/react";

import type { ActivityDef, Id, ProcessView, ProjectedActivity } from "../model.js";
import { buildLaneHierarchy } from "./buildLaneHierarchy.js";
import { layoutHierarchy } from "./layoutHierarchy.js";
export type { LaneNodeData } from "./layoutHierarchy.js";

export type ActivityNodeData = {
  activity: ProjectedActivity;
  flowIndex: number;
  names: readonly string[];
};

export type FlowLane = {
  id: string;
  label: string;
  index: number;
};

export type ProjectionFlow = {
  nodes: Node[];
  edges: Edge[];
  lanes: FlowLane[];
};

const NODE_WIDTH = 180;

function sourceIdsOf(activity: ProjectedActivity): readonly Id[] {
  return activity.kind === "atomic" ? [activity.activityId] : activity.activityIds;
}

function activityNames(
  activity: ProjectedActivity,
  activities: Readonly<Record<Id, ActivityDef>>,
): readonly string[] {
  return sourceIdsOf(activity).map((id) => activities[id]?.name ?? id);
}

export function projectionToFlow(
  view: ProcessView,
  activities: Readonly<Record<Id, ActivityDef>>,
  selectedLeafId: Id | undefined,
  zoomLevel: number,
): ProjectionFlow {
  const hierarchy = buildLaneHierarchy(view, activities, zoomLevel);
  const { laneNodes, activityLayouts } = layoutHierarchy(hierarchy);

  const lanes: FlowLane[] = laneNodes.map((n, i) => ({
    id: n.id,
    label: (n.data as { label: string }).label,
    index: i,
  }));

  const activityNodes: Node[] = view.activities.map((activity, flowIndex) => {
    const layout = activityLayouts.get(activity.id);
    const parentId = layout?.parentId ?? hierarchy.activityParentId.get(activity.id);
    const sourceIds = sourceIdsOf(activity);
    const selected = selectedLeafId !== undefined && sourceIds.includes(selectedLeafId);

    return {
      id: activity.id,
      type: "activity",
      position: { x: layout?.x ?? flowIndex * 220, y: layout?.y ?? 34 },
      data: {
        activity,
        flowIndex,
        names: activityNames(activity, activities),
      } satisfies ActivityNodeData,
      ...(parentId !== undefined ? { parentId, extent: "parent" as const } : {}),
      className: `activity-node${selected ? " is-selected" : ""}`,
      width: NODE_WIDTH,
      selected,
      draggable: false,
      selectable: false,
    } satisfies Node;
  });

  const edges: Edge[] = view.flows.map((flow) => ({
    id: `e:${flow.from}->${flow.to}`,
    source: flow.from,
    target: flow.to,
    markerEnd: { type: MarkerType.ArrowClosed },
    className: "edge-cross-boundary",
  }));

  return {
    nodes: [...laneNodes, ...activityNodes],
    edges,
    lanes,
  };
}
