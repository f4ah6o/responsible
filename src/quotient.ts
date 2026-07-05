import { boundaryOf } from "./boundary.js";
import type {
  Id,
  ProcessModel,
  ProcessView,
  ProjectedActivity,
  ProjectedFlow,
  ViewDef,
} from "./model.js";

/**
 * Graph quotient projection over a directed acyclic Activity graph.
 *
 * This is the nonlinear generalization of `projectByResponsibilityBoundary`
 * (see `docs/nonlinear-projection.md`): branching and merging are in scope,
 * cycles are rejected. Leaves are partitioned into maximal weakly connected
 * components of the induced same-boundary subgraph; each component becomes
 * one projected Activity, cross-component flows collapse into deduplicated
 * projected flows, and same-component flows are hidden.
 *
 * Linear flows remain a special case: for a linear model the result is
 * identical to `projectByResponsibilityBoundary`.
 *
 * Type composition policy (v1, structural): a component's input is the set
 * of its entry activities' input refs, its output the set of exit
 * activities' output refs. A single ref is kept as-is; multiple distinct
 * refs are joined with `" & "` (jointly required, product-style). Alternative
 * outcomes remain the modeler's explicit choice via `Result` / union output
 * types on the branching Activity.
 *
 * Nonlinear projection is a projection capability over `responsible.v0`
 * data; it does not require new model metadata.
 */
export function projectDagByResponsibilityBoundary(
  model: ProcessModel,
  view: ViewDef,
): ProcessView {
  assertLaneResponsibilityView(view);

  const order = topologicalOrder(model);
  if (order.length === 0) {
    return { view, activities: [], flows: [] };
  }

  const topoIndex = new Map<Id, number>(order.map((id, index) => [id, index]));
  const inScope = (id: Id): boolean => topoIndex.has(id);

  const boundaryById = new Map<Id, string>();
  for (const id of order) {
    boundaryById.set(id, boundaryOf(model.activities[id]!, view.boundary));
  }

  // Partition: weak connectivity over edges whose endpoints share a boundary.
  const sameBoundaryAdjacency = new Map<Id, Id[]>(order.map((id) => [id, []]));
  for (const flow of model.flows) {
    if (!inScope(flow.from) || !inScope(flow.to)) continue;
    if (boundaryById.get(flow.from) !== boundaryById.get(flow.to)) continue;
    sameBoundaryAdjacency.get(flow.from)!.push(flow.to);
    sameBoundaryAdjacency.get(flow.to)!.push(flow.from);
  }

  const componentOf = new Map<Id, number>();
  const members: Id[][] = [];
  for (const id of order) {
    if (componentOf.has(id)) continue;
    const component = members.length;
    const queue = [id];
    componentOf.set(id, component);
    const collected: Id[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      collected.push(current);
      for (const next of sameBoundaryAdjacency.get(current) ?? []) {
        if (componentOf.has(next)) continue;
        componentOf.set(next, component);
        queue.push(next);
      }
    }
    collected.sort((a, b) => topoIndex.get(a)! - topoIndex.get(b)!);
    members.push(collected);
  }

  const hasExternalIncoming = new Map<Id, boolean>();
  const hasExternalOutgoing = new Map<Id, boolean>();
  const hasAnyIncoming = new Set<Id>();
  const hasAnyOutgoing = new Set<Id>();
  for (const flow of model.flows) {
    if (!inScope(flow.from) || !inScope(flow.to)) continue;
    hasAnyIncoming.add(flow.to);
    hasAnyOutgoing.add(flow.from);
    if (componentOf.get(flow.from) !== componentOf.get(flow.to)) {
      hasExternalIncoming.set(flow.to, true);
      hasExternalOutgoing.set(flow.from, true);
    }
  }

  const projectedActivities: ProjectedActivity[] = members.map((componentMembers) => {
    const boundary = boundaryById.get(componentMembers[0]!) ?? "<unassigned>";
    // Entries: reached from outside the component, or scope starts.
    const entries = componentMembers.filter(
      (id) => hasExternalIncoming.get(id) === true || !hasAnyIncoming.has(id),
    );
    // Exits: leave the component, or scope terminals.
    const exits = componentMembers.filter(
      (id) => hasExternalOutgoing.get(id) === true || !hasAnyOutgoing.has(id),
    );
    const input = composeTypeRefs(
      (entries.length > 0 ? entries : componentMembers).map((id) => model.activities[id]!.input),
    );
    const output = composeTypeRefs(
      (exits.length > 0 ? exits : componentMembers).map((id) => model.activities[id]!.output),
    );

    if (componentMembers.length === 1) {
      const id = componentMembers[0]!;
      return { id, kind: "atomic", activityId: id, boundary, input, output };
    }
    return {
      id: `composite:${componentMembers.join("+")}`,
      kind: "composite",
      activityIds: componentMembers,
      boundary,
      input,
      output,
    };
  });

  const projectedIdOf = (id: Id): Id => {
    const component = componentOf.get(id)!;
    return projectedActivities[component]!.id;
  };

  const seen = new Set<string>();
  const flows: ProjectedFlow[] = [];
  for (const flow of model.flows) {
    if (!inScope(flow.from) || !inScope(flow.to)) continue;
    const from = projectedIdOf(flow.from);
    const to = projectedIdOf(flow.to);
    if (from === to) continue;
    const key = `${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    flows.push({ from, to });
  }

  return { view, activities: projectedActivities, flows };
}

/**
 * Composes entry/exit type refs into a single component type ref.
 * One distinct ref is kept as-is; several are joined product-style.
 */
function composeTypeRefs(refs: readonly string[]): string {
  const unique: string[] = [];
  for (const ref of refs) {
    if (!unique.includes(ref)) unique.push(ref);
  }
  if (unique.length === 1) return unique[0]!;
  return unique.join(" & ");
}

function assertLaneResponsibilityView(view: ViewDef): void {
  if (view.layout !== "lane") {
    throw new Error(`unsupported layout: ${view.layout}`);
  }
  if (view.normalForm !== "responsibilityBoundary") {
    throw new Error(`unsupported normal form: ${view.normalForm}`);
  }
}

/**
 * Returns activity ids in a deterministic topological order.
 *
 * Scope derivation matches the linear projector: ids referenced by flows when
 * flows exist, otherwise all activities. Rejects cycles and weakly
 * disconnected graphs with explicit errors.
 */
function topologicalOrder(model: ProcessModel): Id[] {
  const flowIds = new Set<Id>();
  for (const flow of model.flows) {
    if (model.activities[flow.from] && model.activities[flow.to]) {
      flowIds.add(flow.from);
      flowIds.add(flow.to);
    }
  }

  const ids = flowIds.size > 0 ? [...flowIds] : Object.keys(model.activities);
  if (ids.length === 0) return [];
  const idSet = new Set(ids);

  const incomingCount = new Map<Id, number>(ids.map((id) => [id, 0]));
  const outgoing = new Map<Id, Id[]>(ids.map((id) => [id, []]));
  const undirected = new Map<Id, Id[]>(ids.map((id) => [id, []]));

  for (const flow of model.flows) {
    if (!idSet.has(flow.from) || !idSet.has(flow.to)) continue;
    outgoing.get(flow.from)!.push(flow.to);
    incomingCount.set(flow.to, incomingCount.get(flow.to)! + 1);
    undirected.get(flow.from)!.push(flow.to);
    undirected.get(flow.to)!.push(flow.from);
  }

  // Weak connectivity: a scope split into unrelated pieces is a modeling error.
  const reached = new Set<Id>([ids[0]!]);
  const queue = [ids[0]!];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of undirected.get(current) ?? []) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  if (reached.size !== ids.length) {
    throw new Error(
      "projection requires all activities in the scope to belong to one weakly connected flow",
    );
  }

  // Kahn's algorithm, FIFO over ids in stable insertion order.
  const result: Id[] = [];
  const ready = ids.filter((id) => incomingCount.get(id) === 0);
  while (ready.length > 0) {
    const current = ready.shift()!;
    result.push(current);
    for (const next of outgoing.get(current) ?? []) {
      const remaining = incomingCount.get(next)! - 1;
      incomingCount.set(next, remaining);
      if (remaining === 0) ready.push(next);
    }
  }

  if (result.length !== ids.length) {
    throw new Error(
      "cycle detected: nonlinear projection supports directed acyclic flows only; loop semantics is future work",
    );
  }

  return result;
}
