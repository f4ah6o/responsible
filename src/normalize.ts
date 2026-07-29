import { boundaryOf } from "./boundary.js";
import { compositeProjectedId, projectedFlowKey } from "./projectedId.js";
import { leafActivityIds } from "./semantic.js";
import type {
  Id,
  ProcessModel,
  ProcessView,
  ProjectedActivity,
  ProjectedFlow,
  ViewDef,
} from "./model.js";

export function projectByResponsibilityBoundary(model: ProcessModel, view: ViewDef): ProcessView {
  assertLaneResponsibilityView(view);

  const orderedActivities = linearOrder(model);
  const projectedActivities: ProjectedActivity[] = [];
  const sourceToProjected = new Map<Id, Id>();
  const occupiedIds = new Set<Id>(Object.keys(model.activities));

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

    const projected = composeRun(model, currentRun, currentBoundary ?? "<unassigned>", occupiedIds);
    projectedActivities.push(projected);
    for (const sourceId of currentRun) sourceToProjected.set(sourceId, projected.id);

    currentRun = [activityId];
    currentBoundary = nextBoundary;
  }

  if (currentRun.length > 0) {
    const projected = composeRun(model, currentRun, currentBoundary ?? "<unassigned>", occupiedIds);
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

function composeRun(
  model: ProcessModel,
  activityIds: Id[],
  boundary: string,
  occupiedIds: Set<Id>,
): ProjectedActivity {
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
    id: compositeProjectedId(activityIds, occupiedIds),
    kind: "composite",
    activityIds,
    boundary,
    input: first.input,
    output: last.output,
  };
}

function collapseFlows(
  model: ProcessModel,
  sourceToProjected: ReadonlyMap<Id, Id>,
): ProjectedFlow[] {
  const seen = new Set<string>();
  const flows: ProjectedFlow[] = [];

  for (const flow of model.flows) {
    const from = sourceToProjected.get(flow.from);
    const to = sourceToProjected.get(flow.to);

    if (!from || !to || from === to) continue;

    const key = projectedFlowKey(from, to);
    if (seen.has(key)) continue;

    seen.add(key);
    flows.push({ from, to });
  }

  return flows;
}

function linearOrder(model: ProcessModel): Id[] {
  // Flow endpoints provide ordering information only. The model itself is
  // the projection scope; otherwise orphan Activities disappear silently.
  const ids = [...leafActivityIds(model)];
  if (ids.length === 0) return [];

  const incoming = new Map<Id, Id[]>();
  const outgoing = new Map<Id, Id[]>();

  for (const id of ids) {
    incoming.set(id, []);
    outgoing.set(id, []);
  }

  for (const flow of model.flows) {
    if (!incoming.has(flow.to) || !outgoing.has(flow.from)) continue;
    outgoing.get(flow.from)!.push(flow.to);
    incoming.get(flow.to)!.push(flow.from);
  }

  const connected = new Set<Id>();
  if (ids.length > 0) {
    const queue = [ids[0]!];
    connected.add(ids[0]!);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of [...(outgoing.get(current) ?? []), ...(incoming.get(current) ?? [])]) {
        if (connected.has(next)) continue;
        connected.add(next);
        queue.push(next);
      }
    }
  }
  if (connected.size !== ids.length) {
    throw new Error(
      `v0 projection requires exactly one start activity and all activities to belong to one connected linear flow (disconnected: ${ids.filter((id) => !connected.has(id)).join(", ")})`,
    );
  }

  for (const id of ids) {
    if ((incoming.get(id)?.length ?? 0) > 1 || (outgoing.get(id)?.length ?? 0) > 1) {
      throw new Error(
        "v0 projection supports linear flows only; branching and merging require graph quotient projection",
      );
    }
  }

  const starts = ids.filter((id) => (incoming.get(id)?.length ?? 0) === 0);
  if (starts.length !== 1) {
    throw new Error("v0 projection requires exactly one start activity in the selected flow");
  }

  const result: Id[] = [];
  const seen = new Set<Id>();
  let current: Id | undefined = starts[0];

  while (current) {
    if (seen.has(current)) {
      throw new Error("cycle detected: v0 projection requires a linear acyclic flow");
    }

    seen.add(current);
    result.push(current);
    current = outgoing.get(current)?.[0];
  }

  if (result.length !== ids.length) {
    throw new Error("v0 projection requires all activities to belong to one connected linear flow");
  }

  return result;
}
