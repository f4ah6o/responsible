# responsible.v1 schema design

English | [日本語](responsible-v1.ja.md)

This document is normative for the `responsible.v1` model schema and its staged implementation. It refines the "future semantic target" sections of [`docs/semantic-core.md`](semantic-core.md) into an assertable schema; where the two disagree, `docs/semantic-core.md` wins on semantics and this document wins on schema shape.

## What v1 is

`responsible.v0` describes an Activity only by its typed interface (`input` / `output`), its `responsibility`, and its decomposition (`children`). The semantic core already defines a richer vocabulary — `requires`, `ensures`, and `effects` ([`docs/activity-effects.md`](activity-effects.md)) — but v0 has no place in the model document to write it down.

`responsible.v1` makes that vocabulary part of the model document, **as plain declarative data**:

- `requires`: facts that must already hold before the Activity can start responsibly.
- `ensures`: facts established in the model world after successful completion.
- `effects`: declarations of which ensured results become observable across a Responsibility Boundary, and under which delivery rule.

## What v1 is not

Unchanged from v0, and explicitly out of scope for v1:

- **No execution API.** `World`, `ActivityResult`, and Kleisli `seq` remain future semantic targets, not schema or API.
- **No symbolic predicates.** `requires` / `ensures` entries are opaque fact references (strings). Static proof of `ensures_A => requires_B` needs a predicate AST or DSL and stays future work.
- **No loop semantics.** Cycles remain rejected.
- **No parallel semantics** beyond the DAG branch/merge already covered by [`docs/nonlinear-projection.md`](nonlinear-projection.md). Note that document's standing decision: DAG projection is a capability over the data and does **not** require v1 — v1 exists for contracts and effects, not for projection.
- **No inverse projection** (`INV-5` unchanged).

## Compatibility principle

v1 is a **strict superset** of v0:

- Every valid `responsible.v0` document becomes a valid `responsible.v1` document by rewriting `schemaVersion` alone. `migrateProcessModelToV1` (`src/migrate.ts`) does exactly this and nothing else.
- Parsing and validation accept both versions. The new Activity fields are rejected with a version hint when they appear in a v0 document, so the version string keeps its meaning.
- Projection (`projectByResponsibilityBoundary`, `projectDagByResponsibilityBoundary`) is version-agnostic: v1 fields never change the projected graph shape, only what is additionally observable on it.

## Schema additions

All additions are optional fields on `ActivityDef`. Authoritative types live in `src/model.ts`.

```ts
type FactRef = string; // opaque fact, e.g. "Application.status = submitted"

type EffectPayloadDef = {
  kind: "domain-fact" | "command" | "data";
  schema: string; // SchemaRef
};

type EffectDeliveryDef =
  | { mode: "directed"; target: Responsibility } // e.g. { role: "Manager" }
  | { mode: "broadcast" }
  | { mode: "observable" };

type EffectDef = {
  id?: string;
  payload: EffectPayloadDef;
  delivery: EffectDeliveryDef;
};

type ActivityDef = {
  // ...v0 fields unchanged...
  requires?: readonly FactRef[]; // v1
  ensures?: readonly FactRef[]; // v1
  effects?: readonly EffectDef[]; // v1
};
```

Example (the running example of `docs/activity-effects.md`):

```json
{
  "id": "submit",
  "input": "DraftApplication",
  "output": "SubmittedApplication",
  "responsibility": { "role": "Applicant" },
  "requires": ["Application.status = draft", "RequiredFields = complete"],
  "ensures": ["Application.status = submitted"],
  "effects": [
    {
      "payload": { "kind": "command", "schema": "ApprovalRequest" },
      "delivery": { "mode": "directed", "target": { "role": "Manager" } }
    }
  ]
}
```

### Design decisions

1. **`source` is derived, never declared.** The semantic `Effect.source` (`src/semantic.ts`) names the producing Activity and its projected boundary. In the model document the producing Activity is the declaring Activity, and its boundary depends on the boundary expression selected at projection time. Declaring `source` would be redundant and could contradict the declaration site, so `EffectDef` omits it; the source half of `INV-3` holds by construction.
2. **A directed `target` is a `Responsibility` record, not a `BoundaryId`.** A `BoundaryId` such as `"Engineering"` only exists relative to a boundary expression (`team`, `[project, function]`, …). The model document must stay boundary-expression-independent, so the target is declared in `responsibility` vocabulary (`{ "role": "Manager" }`) and resolved to a `BoundaryId` with the same `boundaryOf` rule as Activities at projection time.
3. **Fact references are opaque strings.** They are compared only for human review in v1; no equality or implication semantics is defined. A symbolic fact language is deliberately deferred so v1 does not freeze a bad predicate grammar.
4. **`ensures` and `effects` are separate declarations.** Semantically `effects = project(ensures, boundary)`, but v1 cannot compute that projection from opaque facts, so the modeler declares the observable subset explicitly. A future symbolic fact language may make `effects` checkable against `ensures`.

## Validation (stage 1)

`validateProcessModel` accepts `schemaVersion` `"responsible.v0"` or `"responsible.v1"` and reports, with JSON paths:

- v1 fields (`requires` / `ensures` / `effects`) present in a v0 document → error with a version hint.
- `requires` / `ensures`: arrays of non-empty strings.
- `effects[i].payload.kind` ∈ `domain-fact | command | data`; `schema` a non-empty string.
- `effects[i].delivery.mode` ∈ `directed | broadcast | observable`; a directed delivery must carry a non-empty `Responsibility` record as `target`.

## Effect projection (stage 2)

A new read-only core function instantiates semantic `Effect` values from a model, a boundary expression, and a drill-down scope:

```text
projectEffects(model, boundary, scopeId?) -> Effect[]
```

- For each leaf Activity in scope, each `EffectDef` yields an `Effect` whose `source.boundary` is `boundaryOf(activity, boundary)` and whose directed target resolves through the same rule applied to the declared target `Responsibility`.
- **Boundary-crossing rule (RBNF-consistent):** an effect whose resolved source and directed target coincide at the selected boundary is internal (`tau`) at that view and is hidden, mirroring same-boundary flow collapse. Broadcast and observable effects are always retained.
- `INV-3` becomes assertable for declared effects: a directed effect whose resolved target is not a known boundary at the selected view is a validation error (`validateDirectedEffect` is reused).
- `ProcessView` gains an optional `effects` list attached to projected activities, so views stay JSON-serializable. Projection stays read-only (`INV-1`) and lossy (`INV-5`).

## Viewer (stage 3)

- Render declared effects on Activity nodes (payload kind + schema) and directed effects as dashed cross-lane edges distinct from flow edges.
- `ModelLoader` accepts v1 documents; v0 documents load unchanged (optionally offering the v1 upgrade).
- Add a v1 sample process with contracts and effects; keep one v0 sample to pin dual-version support.
- Update `README.md` / `README.ja.md` schema sections and `examples/`.

## Invariants

`INV-1`–`INV-8` carry over unchanged. v1 changes only their assertability:

- `INV-3`: for effects declared in the model, source is correct by construction and directed targets are checked at projection time (stage 2).
- `INV-1` / `INV-5`: `projectEffects` is read-only and non-reversible like all projections.

## Staged plan

| Stage | Scope                                                                                     | Issue                                                       |
| ----- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1     | Schema types, dual-version validation, `migrateProcessModelToV1`, tests                   | `issues/done/20260706-implement-v1-schema-core.md`          |
| 2     | `projectEffects`, boundary-crossing rule, `INV-3` assertion, `ProcessView.effects`, tests | `issues/open/20260706-project-effects-across-boundaries.md` |
| 3     | Viewer effect rendering, v1 sample + example JSON, loader/README/docs updates             | `issues/open/20260706-render-effects-in-viewer.md`          |

Later stages must not begin before the previous stage's acceptance criteria pass, but each stage is independently shippable.

## Assertable subset (v1)

After stage 2, tests must be able to assert:

- Dual-version parsing and the v0 → v1 migration (superset property).
- Structural validity of `requires` / `ensures` / `effects` with JSON-path errors.
- `Effect` instantiation with derived sources and resolved directed targets, including rejection of unknown targets (`INV-3`).
- The boundary-crossing rule: same-boundary directed effects hidden at coarse views, visible at finer views.
- Projection remains read-only and version-agnostic for the flow graph.

Everything under "What v1 is not" stays outside the assertable subset.
