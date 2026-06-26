import type { Node } from "@xyflow/react";
import type { HierarchicalLane, LaneHierarchy } from "./buildLaneHierarchy.js";

export type LaneNodeData = {
  label: string;
  index: number;
  depth: number;
  boundaryKey: string;
  isLeaf: boolean;
};

export type ActivityLayout = {
  parentId: string;
  x: number;
  y: number;
  localIndex: number;
};

export type HierarchyLayout = {
  laneNodes: Node[];
  activityLayouts: Map<string, ActivityLayout>;
};

const LANE_HEADER_HEIGHT = 32;
const LANE_PADDING_X = 16;
const LANE_PADDING_Y = 8;
const LANE_PADDING_BOTTOM = 12;
const HORIZONTAL_STEP = 220;
const LANE_HEIGHT = 200;
const LEFT_PAD = 16;

type Measure = { width: number; height: number };

function measure(lane: HierarchicalLane): Measure {
  if (lane.children.length === 0) {
    return {
      width: LEFT_PAD + Math.max(1, lane.activities.length) * HORIZONTAL_STEP,
      height: LANE_HEIGHT,
    };
  }

  const childMeasures = lane.children.map(measure);
  const maxChildWidth = Math.max(...childMeasures.map((m) => m.width));
  const totalChildHeight = childMeasures.reduce((s, m) => s + m.height, 0);
  const gaps = (lane.children.length - 1) * LANE_PADDING_Y;

  return {
    width: LANE_PADDING_X * 2 + maxChildWidth,
    height: LANE_HEADER_HEIGHT + LANE_PADDING_Y + totalChildHeight + gaps + LANE_PADDING_BOTTOM,
  };
}

let globalIndex = 0;

function placeLane(
  lane: HierarchicalLane,
  position: { x: number; y: number },
  parentId: string | undefined,
  laneNodes: Node[],
  activityLayouts: Map<string, ActivityLayout>,
): Measure {
  const m = measure(lane);

  laneNodes.push({
    id: lane.id,
    type: "laneGroup",
    position,
    data: {
      label: lane.label,
      index: globalIndex++,
      depth: lane.depth,
      boundaryKey: lane.boundaryKey,
      isLeaf: lane.children.length === 0,
    } satisfies LaneNodeData,
    style: { width: m.width, height: m.height },
    className: "lane-node",
    draggable: false,
    selectable: false,
    ...(parentId !== undefined ? { parentId, extent: "parent" as const } : {}),
  });

  if (lane.children.length === 0) {
    lane.activities.forEach((activity, localIndex) => {
      activityLayouts.set(activity.id, {
        parentId: lane.id,
        x: LEFT_PAD + localIndex * HORIZONTAL_STEP,
        y: LANE_HEADER_HEIGHT,
        localIndex,
      });
    });
  } else {
    let childY = LANE_HEADER_HEIGHT + LANE_PADDING_Y;
    for (const child of lane.children) {
      const childPos = { x: LANE_PADDING_X, y: childY };
      const cm = placeLane(child, childPos, lane.id, laneNodes, activityLayouts);
      childY += cm.height + LANE_PADDING_Y;
    }
  }

  return m;
}

export function layoutHierarchy(hierarchy: LaneHierarchy): HierarchyLayout {
  globalIndex = 0;
  const laneNodes: Node[] = [];
  const activityLayouts = new Map<string, ActivityLayout>();

  let rootX = 0;
  for (const root of hierarchy.roots) {
    const m = placeLane(root, { x: rootX, y: 0 }, undefined, laneNodes, activityLayouts);
    rootX += m.width + LANE_PADDING_X;
  }

  return { laneNodes, activityLayouts };
}
