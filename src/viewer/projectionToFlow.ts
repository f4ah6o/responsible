import { MarkerType, type Edge, type Node } from "@xyflow/react";

import type { ActivityDef, Id, ProcessView, ProjectedActivity } from "../model.js";

export type ActivityNodeData = {
  activity: ProjectedActivity;
  flowIndex: number;
  names: readonly string[];
};

export type LaneNodeData = {
  label: string;
  index: number;
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

const HORIZONTAL_STEP = 220;
const NODE_WIDTH = 180;
const LANE_STEP = 220;
const LANE_HEIGHT = 200;
const NODE_Y = 34;
const LEFT_PAD = 16;
const RIGHT_PAD = 48;

function laneIdFor(boundary: string): string {
  return `lane:${boundary}`;
}

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
): ProjectionFlow {
  const laneOrder: string[] = [];
  const laneIndexOf = new Map<string, number>();
  for (const activity of view.activities) {
    if (!laneIndexOf.has(activity.boundary)) {
      laneIndexOf.set(activity.boundary, laneOrder.length);
      laneOrder.push(activity.boundary);
    }
  }

  const lanes: FlowLane[] = laneOrder.map((label, index) => ({
    id: laneIdFor(label),
    label,
    index,
  }));

  const canvasWidth = Math.max(1, view.activities.length) * HORIZONTAL_STEP + RIGHT_PAD;

  const laneNodes: Node[] = lanes.map((lane) => ({
    id: lane.id,
    type: "laneGroup",
    position: { x: 0, y: lane.index * LANE_STEP },
    data: { label: lane.label, index: lane.index } satisfies LaneNodeData,
    style: { width: canvasWidth, height: LANE_HEIGHT },
    className: "lane-node",
    draggable: false,
    selectable: false,
  }));

  const activityNodes: Node[] = view.activities.map((activity, flowIndex) => {
    const sourceIds = sourceIdsOf(activity);
    const selected = selectedLeafId !== undefined && sourceIds.includes(selectedLeafId);

    return {
      id: activity.id,
      type: "activity",
      position: { x: LEFT_PAD + flowIndex * HORIZONTAL_STEP, y: NODE_Y },
      data: {
        activity,
        flowIndex,
        names: activityNames(activity, activities),
      } satisfies ActivityNodeData,
      parentId: laneIdFor(activity.boundary),
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
