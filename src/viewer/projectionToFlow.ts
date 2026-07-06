import { MarkerType, type Edge, type Node } from "@xyflow/react";

import { HIERARCHICAL_BOUNDARY_ORDER } from "../hierarchy.js";
import type { ActivityDef, Id, ProcessView, ProjectedActivity } from "../model.js";
import type { Effect } from "../semantic.js";
import { buildLaneHierarchy, laneIdForBoundary } from "./buildLaneHierarchy.js";
import { layoutHierarchy } from "./layoutHierarchy.js";
export type { LaneNodeData } from "./layoutHierarchy.js";

export type MemberInfo = {
  id: Id;
  name: string;
  input: string;
  output: string;
  responsibilityPath: string;
  effects: readonly Effect[];
};

export type ActivityNodeData = {
  activity: ProjectedActivity;
  flowIndex: number;
  names: readonly string[];
  effects: readonly Effect[];
  /** Per-member detail for composite nodes, so a fold can be expanded in place. */
  members: readonly MemberInfo[];
  /** Horizontal room the card may use when expanded, so the member fold can
   * spread into columns without hitting the next card in the lane. */
  expandMaxWidth: number;
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

// The hierarchical responsibility path of a member (e.g. "管理部 / 審査課 / 審査チーム / 田中"),
// so an expanded fold shows why merged Activities are distinct at finer boundaries.
function responsibilityPath(activity: ActivityDef | undefined): string {
  const responsibility = activity?.responsibility;
  if (!responsibility) return "";
  const values = HIERARCHICAL_BOUNDARY_ORDER.map((key) => responsibility[key]).filter(
    (value): value is string | number | boolean => value !== undefined && value !== null,
  );
  return values.map(String).join(" / ");
}

function membersOf(
  activity: ProjectedActivity,
  activities: Readonly<Record<Id, ActivityDef>>,
  effects: readonly Effect[] | undefined,
): readonly MemberInfo[] {
  if (activity.kind === "atomic") return [];
  return activity.activityIds.map((id) => {
    const def = activities[id];
    return {
      id,
      name: def?.name ?? id,
      input: def?.input ?? "",
      output: def?.output ?? "",
      responsibilityPath: responsibilityPath(def),
      effects: effects?.filter((effect) => effect.source.activityId === id) ?? [],
    } satisfies MemberInfo;
  });
}

export function projectionToFlow(
  view: ProcessView,
  activities: Readonly<Record<Id, ActivityDef>>,
  selectedLeafId: Id | undefined,
  zoomLevel: number,
  measuredHeights?: ReadonlyMap<string, number>,
  effects?: readonly Effect[],
): ProjectionFlow {
  const hierarchy = buildLaneHierarchy(view, activities, zoomLevel);
  const { laneNodes, activityLayouts } = layoutHierarchy(hierarchy, activities, measuredHeights);

  const lanes: FlowLane[] = laneNodes.map((n, i) => ({
    id: n.id,
    label: (n.data as { label: string }).label,
    index: i,
  }));

  const leafToProjectedId = new Map<Id, Id>();
  for (const activity of view.activities) {
    for (const sourceId of sourceIdsOf(activity)) leafToProjectedId.set(sourceId, activity.id);
  }

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
        effects: effects?.filter((effect) => sourceIds.includes(effect.source.activityId)) ?? [],
        members: membersOf(activity, activities, effects),
        expandMaxWidth: layout?.maxWidth ?? NODE_WIDTH,
      } satisfies ActivityNodeData,
      ...(parentId !== undefined ? { parentId, extent: "parent" as const } : {}),
      className: `activity-node${selected ? " is-selected" : ""}`,
      // initialWidth (not width) so the node wrapper tracks the card when an
      // expanded fold widens it, keeping edge anchors on the real right edge.
      initialWidth: NODE_WIDTH,
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
    edges: [...edges, ...effectEdges(effects, leafToProjectedId, laneNodes, zoomLevel)],
    lanes,
  };
}

/**
 * Dashed edges from the projected source node of a directed effect to the
 * lane of its resolved target boundary. Effects whose source or target lane
 * is outside the current view degrade to node badges only.
 */
function effectEdges(
  effects: readonly Effect[] | undefined,
  leafToProjectedId: ReadonlyMap<Id, Id>,
  laneNodes: readonly Node[],
  zoomLevel: number,
): Edge[] {
  if (!effects) return [];

  const pathKeys = HIERARCHICAL_BOUNDARY_ORDER.slice(0, zoomLevel + 1);
  const laneIds = new Set(laneNodes.map((node) => node.id));
  const edges: Edge[] = [];
  const seen = new Set<string>();

  for (const effect of effects) {
    if (effect.delivery.mode !== "directed") continue;
    const sourceNodeId = leafToProjectedId.get(effect.source.activityId);
    if (sourceNodeId === undefined) continue;
    const laneId = laneIdForBoundary(effect.delivery.target, pathKeys);
    if (!laneIds.has(laneId)) continue;

    const id = `fx:${sourceNodeId}->${laneId}:${effect.payload.schema}`;
    if (seen.has(id)) continue;
    seen.add(id);

    edges.push({
      id,
      source: sourceNodeId,
      sourceHandle: "effect",
      target: laneId,
      type: "smoothstep",
      label: effect.payload.schema,
      markerEnd: { type: MarkerType.Arrow },
      className: "edge-effect",
    });
  }

  return edges;
}
