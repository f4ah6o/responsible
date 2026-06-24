# Semantic core

This document is normative for the `responsible` semantic core.

The current reference implementation is still the small TypeScript model described in `docs/reference-implementation.md`: plain data structures, pure functions, and `ProcessModel -> ProcessView`. The TypeScript snippets below that mention `World`, `ActivityResult`, `Effect`, or `BoundaryProjection` are future semantic targets, not current exported API from `src/model.ts`.

## Position

`responsible` models work as Activity composition inside Responsibility Boundaries.

It is not a BPMN runtime, RACI chart tool, Event Sourcing runtime, Actor runtime, or State Machine runtime. Those can be communication layers, downstream projections, or implementation adapters. They are not the semantic core.

The core terms are:

- Activity: a responsibility-bearing unit of work.
- Responsibility Boundary: the selected boundary from which work and effects are observed.
- Projection: a view from a richer model or fact set into a selected boundary.
- RBNF: a boundary-projected quotient view that hides same-boundary internal steps.

## Activity

In current v0, `src/model.ts` exposes `ActivityDef` as plain data with `input`, `output`, `responsibility`, and optional `children`.

The semantic target is richer: an Activity can be read as an effectful computation over a model world. `World` is not the real world. It is the model world, or responsibility state, that `responsible` can describe and check.

Future semantic target, not current v0 API:

```ts
// Future semantic target; not exported by src/model.ts in current v0.
type Activity<I, O> = (world: World, input: I) => ActivityResult<O>;

// Future semantic target; not exported by src/model.ts in current v0.
type ActivityResult<O> = {
  world: World;
  output: O;
  effects: Effect[];
};
```

This says an Activity consumes a model `World` and an `input`, returns a new model `World`, an `output`, and explicit `Effect[]` values. Effects are values, not hidden runtime side effects.

## Composition

Sequential composition is not plain function composition over `Input -> Output`. It is Kleisli composition over `World` plus accumulated `Effect[]`.

Future semantic target, not current v0 API:

```ts
// Future semantic target; not exported by src/model.ts in current v0.
const seq =
  <A, B, C>(f: Activity<A, B>, g: Activity<B, C>): Activity<A, C> =>
  (world, input) => {
    const r1 = f(world, input);
    const r2 = g(r1.world, r1.output);

    return {
      world: r2.world,
      output: r2.output,
      effects: [...r1.effects, ...r2.effects],
    };
  };
```

`seq(f, g)` returns another Activity. This is the semantic reason a parent Activity can be treated as the composition of child Activities.

## Predicates and vocabulary

The vocabulary follows `docs/activity-effects.md` and `docs/data-and-effects.md`.

- `requires`: facts that must already hold before an Activity can start responsibly.
- `ensures`: facts that hold in the model world after successful Activity completion.
- `effects`: the projection of ensured facts that become observable across a Responsibility Boundary.
- `mutation`: an implementation-local data change caused by an Activity.

Current v0 predicates are opaque runtime predicates. They can be called, but the core cannot statically prove `ensures_A => requires_B`. Hoare-style static verification requires a symbolic predicate AST or DSL and is future work.

Future semantic target, not current v0 API:

```ts
// Future semantic target; not exported by src/model.ts in current v0.
type ContractResult = { ok: true } | { ok: false; reason: string };

// Future semantic target; not exported by src/model.ts in current v0.
type Requires<I> = (world: World, input: I) => ContractResult;
type Ensures<O> = (world: World, output: O) => ContractResult;
```

## Projection

Projection is a read-only view operation. Projection must not mutate the source model or the model world.

The semantic relationship is:

```text
effects = project(ensures, boundary)
```

The current v0 implementation has the same shape at the model level:

```text
ProcessModel -> ProcessView
```

Fact projection and model projection are two instances of the same idea: select what is observable from a boundary and hide what remains internal.

Future semantic target, not current v0 API:

```ts
// Future semantic target; not exported by src/model.ts in current v0.
interface BoundaryProjection<In, Out> {
  project(input: In, boundary: BoundaryId): Out;
}
```

For the current TypeScript core, `projectByResponsibilityBoundary(model, view)` is the concrete v0 projection function. It projects leaf Activities for the selected Activity scope and boundary expression, then returns a JSON-serializable `ProcessView`.

## Responsibility Boundary Normal Form

Responsibility Boundary Normal Form, or RBNF, is primarily a quotient view by boundary-crossing observational equivalence.

For a selected boundary:

- a same-boundary internal step is treated as `tau`, a silent action;
- a boundary-crossing effect is treated as an observable action;
- consecutive `tau` steps can be collapsed because they are not observable from the selected boundary.

RBNF is also a projection into the selected boundary. It is lossy and non-reversible. The core must not provide a restoration API that claims to recover the original detailed model from an RBNF view.

Normal form terminology applies only when the projection also selects a minimized representative for the equivalence class. Without that representative choice, RBNF should be described as a quotient view or projection, not as a unique canonical normal form.

Current v0 only supports linear flows. In v0, RBNF is reduced to continuous `tau` collapse for same-boundary runs. It is not general weak bisimulation minimization for branching, merging, or parallel graphs.

## Effect model

An Effect is not a mutation. A mutation is an internal data change caused by an Activity. An Effect is the observable result of an Activity crossing a Responsibility Boundary.

Future semantic target, not current v0 API:

```ts
// Future semantic target; not exported by src/model.ts in current v0.
type Effect = {
  source: {
    activityId: ActivityId;
    boundary: BoundaryId;
  };
  payload:
    | { kind: "domain-fact"; schema: SchemaRef }
    | { kind: "command"; schema: SchemaRef }
    | { kind: "data"; schema: SchemaRef };
  delivery:
    | { mode: "directed"; target: BoundaryId }
    | { mode: "broadcast" }
    | { mode: "observable" };
};
```

The three concerns are:

- `source`: which Activity and source boundary produced the observable result.
- `payload`: what kind of result is crossing the boundary.
- `delivery`: the boundary-crossing visibility rule, such as directed, broadcast, or generally observable.

`delivery` is the visibility rule. There is no separate visibility axis in the semantic core.

## Invariants

These invariants are phrased as assertable or reviewable conditions.

- `INV-1`: View projection must not mutate `ProcessModel`, `World`, Activity definitions, or source facts.
- `INV-2`: Mutation must be caused by Activity execution and remain inside that Activity's world update.
- `INV-3`: A directed effect must have a known source boundary and a known target boundary.
- `INV-4`: Boundary projection must be performed from leaf Activities within the selected Activity scope.
- `INV-5`: RBNF collapse must be treated as non-reversible; no API may claim lossless restoration from the collapsed view.
- `INV-6`: Activity composition must return an Activity, preserving composability of parent and child Activities.

## Verification milestones

v0 runtime checks:

- Runtime contract checking for opaque `requires` and `ensures`.
- Contract chain consistency by executing adjacent Activity predicates where available.
- Effect and boundary consistency, including known source and target boundaries for directed effects.
- Projection consistency: projections are read-only and preserve valid boundary references.
- View consistency: RBNF views do not contain adjacent same-boundary projected steps.

Future static verification:

- Symbolic predicate AST or DSL for static contract proof.
- Static proof of `ensures_A => requires_B`.
- Branching graph reachability.
- Deadlock and livelock checks.
- Workflow soundness for branching, merging, and parallel extensions.
- General quotient and weak bisimulation minimization beyond v0 linear `tau` collapse.
