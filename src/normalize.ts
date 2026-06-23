import { boundaryOf } from "./boundary.js";
import type { Id, ProcessModel, ProcessView, ProjectedActivity, ProjectedFlow, ViewDef } from "./model.js";

export function projectByResponsibilityBoundary(model: ProcessModel, view: ViewDef): ProcessView {
  assertLaneResponsibilityView(view);

  const orderedActivities = topologicalOrder(model);
  const projectedActivities: ProjectedActivity[] = [];
  const sourceToProjected = new Map<Id, Id>();

  let currentRun: Id[] = [];
  let currentBoundary: string | undefined;

  for (const activityId of orderedActivities) {
    const activity = model.activities[activityId];
    if (!activity) continue;

    const nextBoundary = boundaryOf(activity, view.boundary);

    if (currentRun.length === 0 || currentBoundary === nextBoundary) {
      currentRun.push(activityId);
      currentBoundary = nextBoundary;
      continue;
    }

    const projected = composeRun(model, currentRun, currentBoundary ?? "<unassigned>");
    projectedActivities.push(projected);
    for (const sourceId of currentRun) sourceToProjected.set(sourceId, projected.id);

    currentRun = [activityId];
    currentBoundary = nextBoundary;
  }

  if (currentRun.length > 0) {
    const projected = composeRun(model, currentRun, currentBoundary ?? "<unassigned>");
    projectedActivities.push(projected);
    for (const sourceId of currentRun) sourceToProjected.set(sourceId, projected.id);
  }

  const flows = collapseFlows(model, sourceToProjected);

  return {
    view,
    activities: projectedActivities,
    flows,
  };
}

export function isResponsibilityBoundaryNormalForm(view: ProcessView): boolean {
  const byId = new Map(view.activities.map((activity) => [activity.id, activity]));

  for (const flow of view.flows) {
    const from = byId.get(flow.from);
    const to = byId.get(flow.to);
    if (!from || !to) continue;
    if (from.boundary === to.boundary) return false;
  }

  return true;
}

function assertLaneResponsibilityView(view: ViewDef): void {
  if (view.layout !== "lane") {
    throw new Error(`unsupported layout: ${view.layout}`);
  }

  if (view.normalForm !== "responsibilityBoundary") {
    throw new Error(`unsupported normal form: ${view.normalForm}`);
  }
}

function composeRun(model: ProcessModel, activityIds: Id[], boundary: string): ProjectedActivity {
  const first = model.activities[activityIds[0] ?? ""];
  const last = model.activities[activityIds[activityIds.length - 1] ?? ""];

  if (!first || !last) {
    throw new Error("cannot compose an empty or invalid activity run");
  }

  if (activityIds.length === 1) {
    return {
      id: activityIds[0]!,
      kind: "atomic",
      activityId: activityIds[0]!,
      boundary,
      input: first.input,
      output: first.output,
    };
  }

  return {
    id: `composite:${activityIds.join("+")}`,
    kind: "composite",
    activityIds,
    boundary,
    input: first.input,
    output: last.output,
  };
}

function collapseFlows(model: ProcessModel, sourceToProjected: ReadonlyMap<Id, Id>): ProjectedFlow[] {
  const seen = new Set<string>();
  const flows: ProjectedFlow[] = [];

  for (const flow of model.flows) {
    const from = sourceToProjected.get(flow.from);
    const to = sourceToProjected.get(flow.to);

    if (!from || !to || from === to) continue;

    const key = `${from}->${to}`;
    if (seen.has(key)) continue;

    seen.add(key);
    flows.push({ from, to });
  }

  return flows;
}

function topologicalOrder(model: ProcessModel): Id[] {
  const ids = Object.keys(model.activities);
  const indegree = new Map<Id, number>(ids.map((id) => [id, 0]));
  const outgoing = new Map<Id, Id[]>();

  for (const flow of model.flows) {
    if (!model.activities[flow.from] || !model.activities[flow.to]) continue;
    outgoing.set(flow.from, [...(outgoing.get(flow.from) ?? []), flow.to]);
    indegree.set(flow.to, (indegree.get(flow.to) ?? 0) + 1);
  }

  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  const result: Id[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);

    for (const to of outgoing.get(id) ?? []) {
      const next = (indegree.get(to) ?? 0) - 1;
      indegree.set(to, next);
      if (next === 0) queue.push(to);
    }
  }

  if (result.length !== ids.length) {
    throw new Error("cycle detected: responsibility-boundary projection requires an acyclic flow graph in v0");
  }

  return result;
}
