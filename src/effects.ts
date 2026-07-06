import { boundaryOf, boundaryOfResponsibility } from "./boundary.js";
import type { BoundaryExpr, EffectDef, Id, ProcessModel } from "./model.js";
import { type Effect, leafActivityIds, validateDirectedEffect } from "./semantic.js";
import type { ValidationIssue } from "./validate.js";

export type EffectProjectionResult =
  | Readonly<{ ok: true; effects: readonly Effect[] }>
  | Readonly<{ ok: false; issues: readonly ValidationIssue[] }>;

/**
 * Instantiates the semantic `Effect` values observable at a selected
 * Responsibility Boundary from the effects declared in a `responsible.v1`
 * model (docs/responsible-v1.md, stage 2).
 *
 * For each leaf Activity in the selected scope, every declared `EffectDef`
 * yields an `Effect` whose `source.boundary` is derived from the declaring
 * Activity and whose directed `target` (a boundary-expression-independent
 * `Responsibility` record) is resolved with the same `boundaryOf` rule.
 *
 * Boundary-crossing rule (RBNF-consistent): a directed effect whose resolved
 * source and target coincide at the selected boundary is internal (`tau`) at
 * that view and is hidden, mirroring same-boundary flow collapse. Broadcast
 * and observable effects are always retained.
 *
 * A directed effect whose resolved target is not a known boundary at the
 * selected view violates `INV-3` and is reported as an issue instead of being
 * silently dropped. The projection is read-only (`INV-1`) and lossy (`INV-5`);
 * v0 models simply yield no effects.
 */
export function projectEffects(
  model: ProcessModel,
  boundary: BoundaryExpr,
  scopeId?: Id,
): EffectProjectionResult {
  const issues: ValidationIssue[] = [];
  const effects: Effect[] = [];

  for (const id of leafActivityIds(model, scopeId)) {
    const activity = model.activities[id];
    if (!activity?.effects) continue;

    const sourceBoundary = boundaryOf(activity, boundary);
    for (const [index, def] of activity.effects.entries()) {
      const effect = instantiateEffect(id, sourceBoundary, def, boundary);

      if (effect.delivery.mode === "directed") {
        const checked = validateDirectedEffect(model, boundary, effect);
        if (!checked.ok) {
          issues.push({
            path: `$.activities.${id}.effects[${index}].delivery.target`,
            message: `INV-3 違反: ${checked.reason}`,
          });
          continue;
        }
        // Internal (tau) at this view: hidden like same-boundary flow collapse.
        if (effect.delivery.target === sourceBoundary) continue;
      }

      effects.push(effect);
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, effects };
}

function instantiateEffect(
  activityId: Id,
  sourceBoundary: string,
  def: EffectDef,
  boundary: BoundaryExpr,
): Effect {
  return {
    source: { activityId, boundary: sourceBoundary },
    payload: def.payload,
    delivery:
      def.delivery.mode === "directed"
        ? { mode: "directed", target: boundaryOfResponsibility(def.delivery.target, boundary) }
        : def.delivery,
  };
}
