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
const LANE_PADDING_Y = 8;
const LANE_PADDING_BOTTOM = 12;
const HORIZONTAL_STEP = 220;
const LEFT_PAD = 16;
const RIGHT_PAD = 48;

// Card height fallback for nodes not yet measured by ResizeObserver (first
// paint only) — once a measurement arrives it always wins, so lanes track the
// real rendered height, including expanded composite folds.
const CARD_PADDING_V = 20;
const CARD_GAP_TOTAL = 12;
const CARD_FIXED_LINES_HEIGHT = 54;
const TITLE_AVAILABLE_WIDTH = 120;
const TITLE_CHAR_WIDTH = 13;
const TITLE_LINE_HEIGHT = 21;

function estimateTitleLines(title: string): number {
  const charsPerLine = Math.max(1, Math.floor(TITLE_AVAILABLE_WIDTH / TITLE_CHAR_WIDTH));
  return Math.ceil(Math.max(1, title.length) / charsPerLine);
}

const EFFECT_LINE_HEIGHT = 24;
const EFFECT_LIST_GAP = 6;

function estimateCardHeight(title: string, effectCount: number): number {
  return (
    CARD_PADDING_V +
    CARD_GAP_TOTAL +
    CARD_FIXED_LINES_HEIGHT +
    estimateTitleLines(title) * TITLE_LINE_HEIGHT +
    (effectCount > 0 ? EFFECT_LIST_GAP + effectCount * EFFECT_LINE_HEIGHT : 0)
  );
}

// Estimation upper bound: declared effects; the view may hide some as tau.
function declaredEffectCount(
  activity: ProjectedActivity,
  defs: Readonly<Record<Id, ActivityDef>>,
): number {
  const ids = activity.kind === "atomic" ? [activity.activityId] : activity.activityIds;
  return ids.reduce((sum, id) => sum + (defs[id]?.effects?.length ?? 0), 0);
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
  measuredHeights?: ReadonlyMap<string, number>,
): number {
  if (activities.length === 0) return LANE_HEADER_HEIGHT + 120;
  const maxCard = Math.max(
    ...activities.map(
      (a) =>
        measuredHeights?.get(a.id) ??
        estimateCardHeight(activityTitle(a, defs), declaredEffectCount(a, defs)),
    ),
  );
  return LANE_HEADER_HEIGHT + maxCard + LANE_PADDING_BOTTOM;
}

// Swim-lane layout: all lanes are x=0, stacked vertically, sharing the same full canvas width.
// This preserves global flow order on the x axis across all leaf lanes.

type LaneMeasure = { height: number };

function measureLane(
  lane: HierarchicalLane,
  defs: Readonly<Record<Id, ActivityDef>>,
  measuredHeights: ReadonlyMap<string, number> | undefined,
): LaneMeasure {
  if (lane.children.length === 0) {
    return { height: leafLaneHeight(lane.activities, defs, measuredHeights) };
  }

  const childHeights = lane.children.map((c) => measureLane(c, defs, measuredHeights).height);
  const totalChildHeight = childHeights.reduce((s, h) => s + h, 0);
  const gaps = (lane.children.length - 1) * LANE_PADDING_Y;

  return {
    height: LANE_HEADER_HEIGHT + LANE_PADDING_Y + totalChildHeight + gaps + LANE_PADDING_BOTTOM,
  };
}

let globalIndex = 0;

function placeLane(
  lane: HierarchicalLane,
  relativeY: number,
  parentId: string | undefined,
  canvasWidth: number,
  defs: Readonly<Record<Id, ActivityDef>>,
  measuredHeights: ReadonlyMap<string, number> | undefined,
  activityFlowIndex: ReadonlyMap<string, number>,
  laneNodes: Node[],
  activityLayouts: Map<string, ActivityLayout>,
): LaneMeasure {
  const m = measureLane(lane, defs, measuredHeights);

  laneNodes.push({
    id: lane.id,
    type: "laneGroup",
    position: { x: 0, y: relativeY },
    data: {
      label: lane.label,
      index: globalIndex++,
      depth: lane.depth,
      boundaryKey: lane.boundaryKey,
      isLeaf: lane.children.length === 0,
    } satisfies LaneNodeData,
    style: { width: canvasWidth, height: m.height },
    className: "lane-node",
    draggable: false,
    selectable: false,
    ...(parentId !== undefined ? { parentId, extent: "parent" as const } : {}),
  });

  if (lane.children.length === 0) {
    // Leaf lane: position each activity by global flowIndex so x-axis = flow order
    lane.activities.forEach((activity, localIndex) => {
      const fi = activityFlowIndex.get(activity.id) ?? localIndex;
      activityLayouts.set(activity.id, {
        parentId: lane.id,
        x: LEFT_PAD + fi * HORIZONTAL_STEP,
        y: LANE_HEADER_HEIGHT,
        localIndex,
      });
    });
  } else {
    let childY = LANE_HEADER_HEIGHT + LANE_PADDING_Y;
    for (const child of lane.children) {
      const cm = placeLane(
        child,
        childY,
        lane.id,
        canvasWidth,
        defs,
        measuredHeights,
        activityFlowIndex,
        laneNodes,
        activityLayouts,
      );
      childY += cm.height + LANE_PADDING_Y;
    }
  }

  return m;
}

export function layoutHierarchy(
  hierarchy: LaneHierarchy,
  activities: Readonly<Record<Id, ActivityDef>>,
  measuredHeights?: ReadonlyMap<string, number>,
): HierarchyLayout {
  globalIndex = 0;
  const laneNodes: Node[] = [];
  const activityLayouts = new Map<string, ActivityLayout>();

  const totalActivities = hierarchy.activityFlowIndex.size;
  const canvasWidth = LEFT_PAD + Math.max(1, totalActivities) * HORIZONTAL_STEP + RIGHT_PAD;

  // Root lanes stacked vertically at x=0
  let rootY = 0;
  for (const root of hierarchy.roots) {
    const m = placeLane(
      root,
      rootY,
      undefined,
      canvasWidth,
      activities,
      measuredHeights,
      hierarchy.activityFlowIndex,
      laneNodes,
      activityLayouts,
    );
    rootY += m.height + LANE_PADDING_Y;
  }

  return { laneNodes, activityLayouts };
}
