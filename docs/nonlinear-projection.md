# Nonlinear projection design

English | [日本語](nonlinear-projection.ja.md)

This document defines the design target for extending Responsibility Boundary Normal Form projection beyond the v0 linear-flow subset. It is normative for nonlinear projection work.

## Implementation status

The core quotient projection described here is implemented in `src/quotient.ts` as `projectDagByResponsibilityBoundary` and covered by `src/__tests__/quotient.test.ts`:

- Branching and merging over finite DAGs are supported; cycles and weakly disconnected scopes are rejected with explicit errors.
- Partitioning uses maximal weakly connected same-boundary components of the induced same-boundary subgraph (the v1 subset named below).
- The linear case is a special case: for linear models the result is byte-identical to `projectByResponsibilityBoundary`, which is kept as the stricter v0 linear projector.
- Type-ref policy (see below): a single entry/exit ref is kept as-is; multiple distinct refs are joined product-style with `" & "` (jointly required). Alternatives remain the modeler's explicit choice via `Result` / union output types.
- Schema/version decision: nonlinear projection is a projection capability over `responsible.v0` data; no `responsible.v1` model metadata is required.
- The reference viewer uses the DAG projector; the `見積承認（分岐・合流）` sample process exercises branch and merge at every boundary level.

Remaining future work: parallel semantics, exception-path presentation, and richer viewer edge routing. Loop semantics is defined in [`docs/loops.md`](loops.md); cycles stay rejected until its staged implementation lands.

## Graph class

The first nonlinear implementation target is a finite directed acyclic Activity graph.

- Branching and merging are in scope.
- Parallel-looking regions are represented as DAG branches that later merge.
- Cycles are out of scope for this document; their semantics is defined separately in [`docs/loops.md`](loops.md).
- Exception paths are modeled as typed branches, usually with `Result` / union outputs.

The current linear case must remain a special case of the nonlinear design.

## Quotient rule

For a selected Responsibility Boundary expression, each leaf Activity is assigned a boundary with `boundaryOf(activity, boundary)`.

The projected graph is a quotient graph:

1. Build the subgraph induced by the selected scope's leaf Activities.
2. Partition leaves into maximal connected components with the same projected boundary, using weak connectivity over the induced graph.
3. Each component becomes one projected Activity.
4. An edge exists between projected Activities when at least one original flow crosses between their source components.
5. Self-edges introduced by same-component flows are hidden.

This preserves the current linear behavior: a contiguous same-boundary run becomes one composite projected Activity.

## Type composition

Projected component input and output types are derived from graph boundary edges:

- Component inputs are source graph inputs that enter the component from outside, plus root-scope inputs for start components.
- Component outputs are target graph outputs that leave the component, plus root-scope outputs for terminal components.
- A single input or output keeps its original `TypeRef`.
- Multiple alternatives use a union-style type reference.
- Parallel or jointly required values use a record/product-style type reference.
- Branching Activities should make branch choice explicit in their output type, typically with `Result` or union references.

The design does not require v0 to synthesize concrete `TypeDef` records automatically; a future implementation issue must decide whether generated component type refs are structural, named, or opaque.

## Extended invariants

The v0 invariants extend as follows:

- `INV-1`: Projection remains read-only for any DAG.
- `INV-2`: Mutation remains an execution concern, not a projection concern.
- `INV-3`: Directed effects still require known source and target boundaries after quotienting.
- `INV-4`: Projection is still performed from leaf Activities in the selected drill-down scope.
- `INV-5`: The quotient graph is lossy and non-reversible.
- `INV-6`: Each quotient component is still an Activity-shaped projected component with input and output type references.
- `INV-7`: The projected graph contains no edge between distinct same-boundary components that could have been merged under the quotient rule.
- `INV-8`: The projected graph preserves reachability between boundary-crossing observations from the source DAG.

## Examples

### Branch and merge

```text
A(team: Product) -> B(team: Engineering) -> D(team: Release)
                \-> C(team: QA) --------/
```

At `team` boundary, the quotient has Product -> Engineering -> Release and Product -> QA -> Release. Engineering and QA stay separate because their boundaries differ.

At `company` boundary, all Activities share one boundary and collapse into one projected component.

### Same-boundary branch

```text
A(team: Product) -> B(team: Engineering) -> D(team: QA)
                \-> C(team: Engineering) -/
```

At `team` boundary, B and C are weakly connected through A/D only by different-boundary nodes, so they remain separate Engineering components unless the implementation chooses a stricter region analysis that proves they are one same-boundary component. The v1 subset should start with maximal connected same-boundary components in the induced same-boundary subgraph.

## Implementation split

Future work should be split into:

1. Core projection: DAG validation, quotient partitioning, edge collapse, type-ref derivation policy, and tests.
2. Viewer layout: lane layout for branching and merging, edge routing, and selection behavior.
3. Schema/version policy: decide whether nonlinear projection requires `responsible.v1` model metadata or remains a projection capability over `responsible.v0` data.

The first implementation issue should cover branching and merging only. Parallel semantics and exception-path presentation can follow after the quotient and layout contracts are stable.
