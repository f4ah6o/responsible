import type { Id } from "./model.js";

/**
 * Generates a composite projected Activity id without allowing `+` in source
 * ids or an arbitrary atomic id to merge two distinct nodes.
 *
 * The legacy form is retained for ordinary ids to keep existing ProcessView
 * consumers readable. It is upgraded to a deterministic JSON-based form when
 * the legacy delimiter is unsafe or already occupied by an atomic Activity.
 */
export function compositeProjectedId(activityIds: readonly Id[], occupiedIds: Set<Id>): Id {
  const legacy = `composite:${activityIds.join("+")}`;
  if (!activityIds.some((id) => id.includes("+")) && !occupiedIds.has(legacy)) {
    occupiedIds.add(legacy);
    return legacy;
  }

  const encoded = `composite:v2:${encodeURIComponent(JSON.stringify(activityIds))}`;
  let candidate = encoded;
  let suffix = 1;
  while (occupiedIds.has(candidate)) {
    candidate = `${encoded}~${suffix}`;
    suffix += 1;
  }
  occupiedIds.add(candidate);
  return candidate;
}

/** Collision-free key for a projected `(from, to)` pair. */
export function projectedFlowKey(from: Id, to: Id): string {
  return JSON.stringify(["projected-flow", from, to]);
}
