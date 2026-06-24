import { boundaryOf } from "./boundary.js";
import type { BoundaryExpr, Id, ProcessModel, ProcessView } from "./model.js";

export type ActivityId = Id;
export type BoundaryId = string;
export type SchemaRef = string;
export type Projection = "responsibilityBoundary";
export type RBNF = ProcessView;
export type RequiresRef = string;
export type EnsuresRef = string;

export type EffectPayload =
  | Readonly<{ kind: "domain-fact"; schema: SchemaRef }>
  | Readonly<{ kind: "command"; schema: SchemaRef }>
  | Readonly<{ kind: "data"; schema: SchemaRef }>;

export type EffectDelivery =
  | Readonly<{ mode: "directed"; target: BoundaryId }>
  | Readonly<{ mode: "broadcast" }>
  | Readonly<{ mode: "observable" }>;

export type Effect = Readonly<{
  source: Readonly<{ activityId: ActivityId; boundary: BoundaryId }>;
  payload: EffectPayload;
  delivery: EffectDelivery;
}>;

export type ContractResult = { ok: true } | { ok: false; reason: string };

export function leafActivityIds(model: ProcessModel, scopeId?: Id): readonly Id[] {
  const candidateIds = scopeId
    ? [scopeId, ...descendantsOf(model, scopeId)]
    : Object.keys(model.activities);
  const result: Id[] = [];

  for (const id of candidateIds) {
    const activity = model.activities[id];
    if (!activity) continue;
    if (!activity.children || activity.children.length === 0) {
      result.push(id);
    }
  }

  return result;
}

export function knownBoundaryIds(
  model: ProcessModel,
  boundary: BoundaryExpr,
): ReadonlySet<BoundaryId> {
  const ids = new Set<BoundaryId>();

  for (const id of leafActivityIds(model)) {
    const activity = model.activities[id];
    if (!activity) continue;
    ids.add(boundaryOf(activity, boundary));
  }

  return ids;
}

export function validateDirectedEffect(
  model: ProcessModel,
  boundary: BoundaryExpr,
  effect: Effect,
): ContractResult {
  const sourceActivity = model.activities[effect.source.activityId];
  if (!sourceActivity) {
    return { ok: false, reason: `unknown source activityId: ${effect.source.activityId}` };
  }

  const actualSourceBoundary = boundaryOf(sourceActivity, boundary);
  if (actualSourceBoundary !== effect.source.boundary) {
    return {
      ok: false,
      reason: `source boundary mismatch: activity "${effect.source.activityId}" projects to "${actualSourceBoundary}" but the effect declares "${effect.source.boundary}"`,
    };
  }

  if (effect.delivery.mode === "directed") {
    const known = knownBoundaryIds(model, boundary);
    if (!known.has(effect.delivery.target)) {
      return { ok: false, reason: `unknown directed target boundary: ${effect.delivery.target}` };
    }
  }

  return { ok: true };
}

function descendantsOf(model: ProcessModel, scopeId: Id): Id[] {
  const result: Id[] = [];
  const seen = new Set<Id>();

  const visit = (id: Id): void => {
    const activity = model.activities[id];
    if (!activity?.children) return;
    for (const childId of activity.children) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      result.push(childId);
      visit(childId);
    }
  };

  visit(scopeId);
  return result;
}
