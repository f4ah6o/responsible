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

const LANE_HEADER_HEIGHT = 36;
const LANE_PADDING_Y = 4;
const LANE_PADDING_BOTTOM = 12;
const HORIZONTAL_STEP = 220;
const LEFT_PAD = 16;
const RIGHT_PAD = 48;

// Card height estimation
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

function estimateCardHeight(title: string): number {
  return (
    CARD_PADDING_V +
    CARD_GAP_TOTAL +
    CARD_FIXED_LINES_HEIGHT +
    estimateTitleLines(title) * TITLE_LINE_HEIGHT
  );
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
      (a) => measuredHeights?.get(a.id) ?? estimateCardHeight(activityTitle(a, defs)),
    ),
  );
  return LANE_HEADER_HEIGHT + maxCard + LANE_PADDING_BOTTOM;
}

type LeafEntry = { lane: HierarchicalLane; pathLabel: string };

function collectLeafs(lane: HierarchicalLane, ancestorLabels: string[]): LeafEntry[] {
  const path = [...ancestorLabels, lane.label];
  if (lane.children.length === 0) {
    return [{ lane, pathLabel: path.join(" › ") }];
  }
  return lane.children.flatMap((child) => collectLeafs(child, path));
}

export function layoutHierarchy(
  hierarchy: LaneHierarchy,
  activities: Readonly<Record<Id, ActivityDef>>,
  measuredHeights?: ReadonlyMap<string, number>,
): HierarchyLayout {
  const laneNodes: Node[] = [];
  const activityLayouts = new Map<string, ActivityLayout>();

  const totalActivities = hierarchy.activityFlowIndex.size;
  const canvasWidth = LEFT_PAD + Math.max(1, totalActivities) * HORIZONTAL_STEP + RIGHT_PAD;

  // Collect all leaf lanes in DFS order, each with its full breadcrumb path
  const leafEntries = hierarchy.roots.flatMap((root) => collectLeafs(root, []));

  let y = 0;
  let index = 0;
  for (const { lane, pathLabel } of leafEntries) {
    const height = leafLaneHeight(lane.activities, activities, measuredHeights);

    laneNodes.push({
      id: lane.id,
      type: "laneGroup",
      position: { x: 0, y },
      data: {
        label: pathLabel,
        index: index++,
        depth: 0,
        boundaryKey: lane.boundaryKey,
        isLeaf: true,
      } satisfies LaneNodeData,
      style: { width: canvasWidth, height },
      className: "lane-node",
      draggable: false,
      selectable: false,
    });

    lane.activities.forEach((activity, localIndex) => {
      const fi = hierarchy.activityFlowIndex.get(activity.id) ?? localIndex;
      activityLayouts.set(activity.id, {
        parentId: lane.id,
        x: LEFT_PAD + fi * HORIZONTAL_STEP,
        y: LANE_HEADER_HEIGHT,
        localIndex,
      });
    });

    y += height + LANE_PADDING_Y;
  }

  return { laneNodes, activityLayouts };
}
