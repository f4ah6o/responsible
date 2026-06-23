import type { ActivityDef, Id, ProcessModel, ProcessView } from "./model.js";

export type GraphNodeKind = "focus" | "composite" | "leaf" | "projected";

export type GraphNode = Readonly<{
  id: Id;
  label: string;
  detail: string;
  x: number;
  y: number;
  kind: GraphNodeKind;
  activityId?: Id;
  focusable?: boolean;
  selected?: boolean;
}>;

export type GraphEdge = Readonly<{
  from: Id;
  to: Id;
}>;

export type GraphLayout = Readonly<{
  width: number;
  height: number;
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
}>;

const horizontalGap = 260;
const verticalGap = 160;
const marginX = 120;
const marginY = 72;

export function layoutActivityTreeGraph(model: ProcessModel, rootId: Id, focusId: Id, selectedId: Id): GraphLayout {
  const levels: Id[][] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<Id>();

  function walk(id: Id, depth: number): void {
    if (seen.has(id)) return;
    seen.add(id);

    if (!levels[depth]) levels[depth] = [];
    levels[depth]!.push(id);

    const children = model.activities[id]?.children ?? [];
    for (const childId of children) {
      if (model.activities[childId]) {
        edges.push({ from: id, to: childId });
        walk(childId, depth + 1);
      }
    }
  }

  walk(rootId, 0);

  const widest = Math.max(1, ...levels.map((level) => level.length));
  const width = Math.max(760, marginX * 2 + Math.max(0, widest - 1) * horizontalGap);
  const height = Math.max(260, marginY * 2 + Math.max(0, levels.length - 1) * verticalGap);
  const nodes: GraphNode[] = [];

  levels.forEach((level, depth) => {
    const span = Math.max(0, (level.length - 1) * horizontalGap);
    const startX = width / 2 - span / 2;

    level.forEach((id, index) => {
      const activity = model.activities[id];
      if (!activity) return;
      const children = activity.children ?? [];
      nodes.push({
        id,
        label: activity.name ?? id,
        detail: `${activity.input} → ${activity.output}`,
        x: startX + index * horizontalGap,
        y: marginY + depth * verticalGap,
        kind: id === focusId ? "focus" : children.length > 0 ? "composite" : "leaf",
        activityId: id,
        focusable: children.length > 0,
        selected: id === selectedId,
      });
    });
  });

  return { width, height, nodes, edges };
}

export function layoutProjectedGraph(view: ProcessView, activities: Readonly<Record<Id, ActivityDef>>, selectedId: Id): GraphLayout {
  const width = Math.max(760, marginX * 2 + Math.max(0, view.activities.length - 1) * horizontalGap);
  const height = 280;
  const nodes: GraphNode[] = view.activities.map((node, index) => {
    const activityIds = node.kind === "atomic" ? [node.activityId] : [...node.activityIds];
    const firstId = activityIds[0] ?? node.id;
    const label = node.kind === "atomic" ? activities[firstId]?.name ?? firstId : `${activityIds.length} activities`;
    const detail = `${node.boundary} / ${node.input} → ${node.output}`;

    return {
      id: node.id,
      label,
      detail,
      x: marginX + index * horizontalGap,
      y: marginY + 64,
      kind: "projected",
      activityId: firstId,
      selected: activityIds.includes(selectedId),
    };
  });

  return {
    width,
    height,
    nodes,
    edges: view.flows,
  };
}
