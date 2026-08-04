import {
  boundaryOf,
  decodeBoundaryId,
  displayBoundaryValue,
  resolveBoundaryValue,
} from "./boundary.js";
import type {
  ActivityDef,
  ActivityStatus,
  BoundaryExpr,
  EffectDeliveryDef,
  EffectPayloadKind,
  Id,
  ProcessModel,
} from "./model.js";
import { leafActivityIds } from "./semantic.js";

export type AnalysisCount = Readonly<{ total: number; activityIds: readonly Id[] }>;

export type BoundaryGroup = Readonly<{
  id: string;
  label: string;
  activityIds: readonly Id[];
}>;

export type ResponsibilityHandoff = Readonly<{
  fromActivityId: Id;
  toActivityId: Id;
  fromBoundary: string;
  toBoundary: string;
}>;

export type AutomationGapReason =
  | "status-not-automatable"
  | "responsibility-unassigned"
  | "requires-undeclared"
  | "ensures-undeclared";

export type AutomationGap = Readonly<{
  activityId: Id;
  reasons: readonly AutomationGapReason[];
}>;

export type ModelAnalysis = Readonly<{
  schemaVersion: ProcessModel["schemaVersion"];
  boundary: BoundaryExpr;
  summary: Readonly<{
    activities: number;
    leafActivities: number;
    compositeActivities: number;
    flows: number;
    types: number;
    views: number;
    statuses: Readonly<Record<ActivityStatus | "unspecified", number>>;
  }>;
  topology: Readonly<{
    entryActivityIds: readonly Id[];
    exitActivityIds: readonly Id[];
    isolatedActivityIds: readonly Id[];
    cycles: readonly (readonly Id[])[];
  }>;
  semantics: Readonly<{
    boundaryKeys: readonly string[];
    activitiesWithRequires: AnalysisCount;
    activitiesWithEnsures: AnalysisCount;
    activitiesWithEffects: AnalysisCount;
    effects: Readonly<{
      total: number;
      byPayloadKind: Readonly<Record<EffectPayloadKind, number>>;
      byDeliveryMode: Readonly<Record<EffectDeliveryDef["mode"], number>>;
    }>;
    referencedTypes: readonly string[];
  }>;
  responsibility: Readonly<{
    assignedActivityIds: readonly Id[];
    unassignedActivityIds: readonly Id[];
    groups: readonly BoundaryGroup[];
    handoffs: readonly ResponsibilityHandoff[];
  }>;
  automation: Readonly<{
    declaredAutomatableActivityIds: readonly Id[];
    readySignalActivityIds: readonly Id[];
    gaps: readonly AutomationGap[];
  }>;
}>;

/**
 * Produces a deterministic, machine-readable semantic report for a model.
 *
 * Unlike a diagram projection, this report keeps control flow, responsibility,
 * contracts, effects, and automation maturity visible at the same time. It is
 * intended for CI, agents, governance checks, and higher-level tooling.
 */
export function analyzeProcessModel(
  model: ProcessModel,
  boundary: BoundaryExpr = "department",
): ModelAnalysis {
  const allIds = Object.keys(model.activities).sort(compareText);
  const leaves = [...leafActivityIds(model)].sort(compareText);
  const leafSet = new Set(leaves);
  const leafFlows = model.flows.filter((flow) => leafSet.has(flow.from) && leafSet.has(flow.to));

  const indegree = new Map(leaves.map((id) => [id, 0]));
  const outdegree = new Map(leaves.map((id) => [id, 0]));
  const adjacency = new Map(leaves.map((id) => [id, [] as Id[]]));

  for (const flow of leafFlows) {
    indegree.set(flow.to, (indegree.get(flow.to) ?? 0) + 1);
    outdegree.set(flow.from, (outdegree.get(flow.from) ?? 0) + 1);
    adjacency.get(flow.from)?.push(flow.to);
  }
  for (const targets of adjacency.values()) targets.sort(compareText);

  const entryActivityIds = leaves.filter((id) => (indegree.get(id) ?? 0) === 0);
  const exitActivityIds = leaves.filter((id) => (outdegree.get(id) ?? 0) === 0);
  const isolatedActivityIds = leaves.filter(
    (id) => (indegree.get(id) ?? 0) === 0 && (outdegree.get(id) ?? 0) === 0,
  );

  const statuses: Record<ActivityStatus | "unspecified", number> = {
    discovered: 0,
    defined: 0,
    validated: 0,
    automatable: 0,
    unspecified: 0,
  };
  for (const id of allIds) statuses[model.activities[id]?.status ?? "unspecified"] += 1;

  const boundaryKeys = new Set<string>();
  const referencedTypes = new Set<string>();
  const requiresIds: Id[] = [];
  const ensuresIds: Id[] = [];
  const effectsIds: Id[] = [];
  const effectPayloadCounts: Record<EffectPayloadKind, number> = {
    "domain-fact": 0,
    command: 0,
    data: 0,
  };
  const effectDeliveryCounts: Record<EffectDeliveryDef["mode"], number> = {
    directed: 0,
    broadcast: 0,
    observable: 0,
  };

  for (const id of allIds) {
    const activity = model.activities[id];
    if (!activity) continue;
    for (const key of Object.keys(activity.responsibility ?? {})) boundaryKeys.add(key);
    referencedTypes.add(activity.input);
    referencedTypes.add(activity.output);
    if ((activity.requires?.length ?? 0) > 0) requiresIds.push(id);
    if ((activity.ensures?.length ?? 0) > 0) ensuresIds.push(id);
    if ((activity.effects?.length ?? 0) > 0) effectsIds.push(id);
    for (const effect of activity.effects ?? []) {
      effectPayloadCounts[effect.payload.kind] += 1;
      effectDeliveryCounts[effect.delivery.mode] += 1;
    }
  }

  const groups = new Map<string, Id[]>();
  const assignedActivityIds: Id[] = [];
  const unassignedActivityIds: Id[] = [];
  for (const id of leaves) {
    const activity = model.activities[id];
    if (!activity) continue;
    const boundaryId = boundaryOf(activity, boundary);
    const assigned = boundaryAssigned(activity, boundary);
    (assigned ? assignedActivityIds : unassignedActivityIds).push(id);
    const ids = groups.get(boundaryId) ?? [];
    ids.push(id);
    groups.set(boundaryId, ids);
  }

  const handoffs: ResponsibilityHandoff[] = [];
  for (const flow of leafFlows) {
    const from = model.activities[flow.from];
    const to = model.activities[flow.to];
    if (!from || !to) continue;
    const fromBoundary = boundaryOf(from, boundary);
    const toBoundary = boundaryOf(to, boundary);
    if (fromBoundary === toBoundary) continue;
    handoffs.push({
      fromActivityId: flow.from,
      toActivityId: flow.to,
      fromBoundary,
      toBoundary,
    });
  }
  handoffs.sort((a, b) =>
    compareTuple(
      [a.fromActivityId, a.toActivityId, a.fromBoundary, a.toBoundary],
      [b.fromActivityId, b.toActivityId, b.fromBoundary, b.toBoundary],
    ),
  );

  const declaredAutomatableActivityIds: Id[] = [];
  const readySignalActivityIds: Id[] = [];
  const gaps: AutomationGap[] = [];
  for (const id of leaves) {
    const activity = model.activities[id];
    if (!activity) continue;
    const reasons: AutomationGapReason[] = [];
    if (activity.status !== "automatable") reasons.push("status-not-automatable");
    else declaredAutomatableActivityIds.push(id);
    if (!boundaryAssigned(activity, boundary)) reasons.push("responsibility-unassigned");
    if ((activity.requires?.length ?? 0) === 0) reasons.push("requires-undeclared");
    if ((activity.ensures?.length ?? 0) === 0) reasons.push("ensures-undeclared");
    if (reasons.length === 0) readySignalActivityIds.push(id);
    else gaps.push({ activityId: id, reasons });
  }

  return {
    schemaVersion: model.schemaVersion,
    boundary,
    summary: {
      activities: allIds.length,
      leafActivities: leaves.length,
      compositeActivities: allIds.length - leaves.length,
      flows: model.flows.length,
      types: Object.keys(model.types ?? {}).length,
      views: model.views?.length ?? 0,
      statuses,
    },
    topology: {
      entryActivityIds,
      exitActivityIds,
      isolatedActivityIds,
      cycles: findCycles(leaves, adjacency),
    },
    semantics: {
      boundaryKeys: [...boundaryKeys].sort(compareText),
      activitiesWithRequires: countWithIds(requiresIds),
      activitiesWithEnsures: countWithIds(ensuresIds),
      activitiesWithEffects: countWithIds(effectsIds),
      effects: {
        total: Object.values(effectPayloadCounts).reduce((sum, count) => sum + count, 0),
        byPayloadKind: effectPayloadCounts,
        byDeliveryMode: effectDeliveryCounts,
      },
      referencedTypes: [...referencedTypes].sort(compareText),
    },
    responsibility: {
      assignedActivityIds,
      unassignedActivityIds,
      groups: [...groups.entries()]
        .sort(([a], [b]) => compareText(a, b))
        .map(([id, activityIds]) => ({ id, label: boundaryLabel(id), activityIds })),
      handoffs,
    },
    automation: {
      declaredAutomatableActivityIds,
      readySignalActivityIds,
      gaps,
    },
  };
}

function boundaryAssigned(activity: ActivityDef, boundary: BoundaryExpr): boolean {
  const keys = typeof boundary === "string" ? [boundary] : boundary;
  return keys.every((key) => resolveBoundaryValue(activity, key) !== undefined);
}

function boundaryLabel(id: string): string {
  return decodeBoundaryId(id)
    .map(({ key, value }) => {
      const rendered = displayBoundaryValue(value);
      return key ? `${key}=${rendered}` : rendered;
    })
    .join(" / ");
}

function countWithIds(activityIds: readonly Id[]): AnalysisCount {
  return { total: activityIds.length, activityIds: [...activityIds].sort(compareText) };
}

function findCycles(
  nodes: readonly Id[],
  adjacency: ReadonlyMap<Id, readonly Id[]>,
): readonly (readonly Id[])[] {
  let nextIndex = 0;
  const indices = new Map<Id, number>();
  const lowLinks = new Map<Id, number>();
  const stack: Id[] = [];
  const onStack = new Set<Id>();
  const components: Id[][] = [];

  const visit = (node: Id): void => {
    indices.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const target of adjacency.get(node) ?? []) {
      if (!indices.has(target)) {
        visit(target);
        lowLinks.set(node, Math.min(lowLinks.get(node)!, lowLinks.get(target)!));
      } else if (onStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node)!, indices.get(target)!));
      }
    }

    if (lowLinks.get(node) !== indices.get(node)) return;
    const component: Id[] = [];
    while (stack.length > 0) {
      const member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
      if (member === node) break;
    }
    component.sort(compareText);
    if (
      component.length > 1 ||
      (component.length === 1 && (adjacency.get(component[0]!) ?? []).includes(component[0]!))
    ) {
      components.push(component);
    }
  };

  for (const node of nodes) if (!indices.has(node)) visit(node);
  components.sort((a, b) => compareTuple(a, b));
  return components;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareTuple(a: readonly string[], b: readonly string[]): number {
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const compared = compareText(a[index]!, b[index]!);
    if (compared !== 0) return compared;
  }
  return a.length - b.length;
}
