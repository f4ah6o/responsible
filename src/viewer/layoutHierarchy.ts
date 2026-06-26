import type { Node } from "@xyflow/react";
import type { HierarchicalLane, LaneHierarchy } from "./buildLaneHierarchy.js";
import type { ActivityDef, Id, ProjectedActivity } from "../model.js";

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
const MIN_LANE_HEIGHT = 120;
const LEFT_PAD = 16;

// Activity card height estimation
const CARD_PADDING_V = 20; // top + bottom padding
const CARD_GAP_TOTAL = 12; // 3 gaps × 4px
const CARD_FIXED_LINES_HEIGHT = 54; // subtitle + type + boundary pill (~18+18+22 + gaps)
const TITLE_AVAILABLE_WIDTH = 120; // card inner width minus kind badge
const TITLE_CHAR_WIDTH = 13; // average px per Japanese/mixed char
const TITLE_LINE_HEIGHT = 21; // px per line at 0.92rem bold

function estimateTitleLines(title: string): number {
  const charsPerLine = Math.max(1, Math.floor(TITLE_AVAILABLE_WIDTH / TITLE_CHAR_WIDTH));
  return Math.ceil(Math.max(1, title.length) / charsPerLine);
}

function estimateCardHeight(title: string): number {
  return CARD_PADDING_V + CARD_GAP_TOTAL + CARD_FIXED_LINES_HEIGHT + estimateTitleLines(title) * TITLE_LINE_HEIGHT;
}

function activityTitle(
  activity: ProjectedActivity,
  defs: Readonly<Record<Id, ActivityDef>>,
): string {
  if (activity.kind === "atomic") return defs[activity.activityId]?.name ?? activity.activityId;
  return activity.activityIds.map((id) => defs[id]?.name ?? id).join(" + ");
}

function leafLaneHeight(
  activities: ProjectedActivity[],
  defs: Readonly<Record<Id, ActivityDef>>,
): number {
  if (activities.length === 0) return LANE_HEADER_HEIGHT + MIN_LANE_HEIGHT;
  const maxCard = Math.max(...activities.map((a) => estimateCardHeight(activityTitle(a, defs))));
  return LANE_HEADER_HEIGHT + maxCard + LANE_PADDING_BOTTOM;
}

type Measure = { width: number; height: number };

function measure(lane: HierarchicalLane, defs: Readonly<Record<Id, ActivityDef>>): Measure {
  if (lane.children.length === 0) {
    return {
      width: LEFT_PAD + Math.max(1, lane.activities.length) * HORIZONTAL_STEP,
      height: leafLaneHeight(lane.activities, defs),
    };
  }

  const childMeasures = lane.children.map((c) => measure(c, defs));
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
  defs: Readonly<Record<Id, ActivityDef>>,
  laneNodes: Node[],
  activityLayouts: Map<string, ActivityLayout>,
): Measure {
  const m = measure(lane, defs);

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
      const cm = placeLane(child, childPos, lane.id, defs, laneNodes, activityLayouts);
      childY += cm.height + LANE_PADDING_Y;
    }
  }

  return m;
}

export function layoutHierarchy(
  hierarchy: LaneHierarchy,
  activities: Readonly<Record<Id, ActivityDef>>,
): HierarchyLayout {
  globalIndex = 0;
  const laneNodes: Node[] = [];
  const activityLayouts = new Map<string, ActivityLayout>();

  let rootX = 0;
  for (const root of hierarchy.roots) {
    const m = placeLane(root, { x: rootX, y: 0 }, undefined, activities, laneNodes, activityLayouts);
    rootX += m.width + LANE_PADDING_X;
  }

  return { laneNodes, activityLayouts };
}
