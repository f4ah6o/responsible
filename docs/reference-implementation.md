# Reference implementation policy

The implementation in this repository is a reference implementation, not the only runtime.

The goal is to make the model executable while keeping the core small enough to inspect, port, and replace.

## Dependency policy

Runtime dependencies should be avoided by default.

```text
core runtime dependencies: 0
reference language: TypeScript / JavaScript
visualization: outside the core
```

TypeScript is used because the model is tightly connected to frontend visualization, but the core should not depend on React, Vue, Svelte, canvas libraries, graph layout engines, schema validators, or parser generators.

The core package should expose pure functions and plain data structures.

```text
ProcessModel -> ProcessView
```

Visualization layers can consume `ProcessView` and render it as lane / swimlane UI.

## Reference implementation scope

The first implementation should cover only the semantic core:

1. Activity model
2. Input / Output type references
3. Responsibility attributes
4. Boundary resolution
5. Responsibility Boundary Normal Form projection
6. Plain JSON-serializable view model
7. Activity decomposition drill-down by `children` (separate from boundary zoom)
8. SVG graph-node visualization
9. Graph lanes for responsibility-boundary projection

The core should not include:

1. React components
2. graph layout engines
3. BPMN runtime
4. DSL parser
5. persistence layer
6. server framework
7. validation libraries

Those can be added as separate adapters after the model stabilizes.

## Zoom and decomposition

Per `README.md` (`Digital zoom`, `Design principles`), **zoom means choosing a responsibility boundary level**, not moving along the Activity decomposition hierarchy. These are two separate axes of the reference UI:

```text
zoom        = choose responsibility boundary level (hierarchical)
drill-down  = choose Activity decomposition scope (children)
```

### Responsibility boundary zoom

The hierarchical responsibility boundaries are ordered from the most coarse level to the most detailed level:

```text
company < department < section < team < person
```

This ordered constant (`src/hierarchy.ts`, re-exported from `src/index.ts`) is the single source of truth for boundary zoom. Zoom in moves one step toward `person`; zoom out moves one step toward `company`. Both ends clamp, and the corresponding buttons are disabled at the ends.

Zoom operates on a fixed scope. The displayed process's leaf set does not change when zooming:

```text
ProcessView = normalize(project(scope.leaves, boundaryLevel))
```

Only `boundaryLevel` changes between zoom steps. The same Activity Graph and the same displayed-process leaf set are projected at every level.

```text
company view:
  Example Construction -> Partner Company -> Example Construction

department view:
  Sales Department -> Construction Department -> Administration Department

section view:
  Sales Section -> Estimation Section -> Sales Section -> Construction Section -> Procurement Section -> Construction Section -> Accounting Section
```

### Display-axis switch (non-hierarchical boundaries)

`function`, `role`, `system`, and composite boundaries such as `[project, function]` are not part of the hierarchical zoom order. They are selected as a different display axis, independent of zoom.

### Activity decomposition (drill-down)

A parent Activity can be decomposed by `children`.

```text
receive_contract_process
  -> receive_order
       -> receive_inquiry
       -> create_estimate
       -> approve_estimate
       -> accept_order
  -> execute_project
       -> plan_construction
       -> procure_materials
       -> complete_work
  -> bill_customer
       -> issue_invoice
```

The UI keeps a separate decomposition scope for the Activity screen. The Activity screen shows the immediate children of that scope. Moving this scope is called **drill-down / drill-out**, not zoom. It does not affect the responsibility-boundary projection, which always projects the displayed-process leaf set.

```text
drill-down  : scope -> scope.children
drill-out   : scope -> scope.parent
projection  : project(displayedProcess.leaves, boundaryLevel)   (independent of drill scope)
```

## Graph node visualization

The `Graph nodes` screen renders two SVG graphs without adding a rendering dependency.

```text
Activity tree graph
  parent Activity -> child Activity

Boundary projection graph
  lane(boundary value)
    projected Activity node -> projected Activity node
```

The first graph makes decomposition visible. Composite Activity nodes are clickable drill-down targets (the decomposition scope for the Activity screen). Leaf Activity nodes represent executable detail. Drill-down is a separate operation from responsibility-boundary zoom.

The second graph uses the displayed-process scope and the selected responsibility-boundary level. It renders the normalized projected graph after same-boundary runs have been collapsed into projected nodes. Boundary values are rendered as horizontal lanes, and cross-boundary transitions appear as edges that cross lanes.

```text
layout(project(displayedProcess.leaves, boundaryLevel)) -> SVG lanes + nodes + edges
```

This keeps visualization downstream of the model. The graph is a view, not a new semantic layer.

## Layering

```text
src/model.ts
  Data types only.

src/boundary.ts
  boundaryOf(activity, boundaryExpr).

src/hierarchy.ts
  Hierarchical responsibility-boundary zoom order and level helpers.

src/normalize.ts
  Responsibility Boundary Normal Form projection.

src/graph.ts
  Dependency-free graph layout for reference SVG views.

src/index.ts
  Public API exports.
```

Future visualization packages can sit outside the core.

```text
@responsible/core       pure TypeScript reference implementation
@responsible/view-json  stable view projection format
@responsible/react      optional React renderer
@responsible/svg        optional SVG renderer
@responsible/dsl        optional parser / printer
```

Package names are placeholders.

## v0 limitation

The initial v0 projection intentionally supports linear flows only.

```text
A -> B -> C -> D
```

This is enough to prove the core idea:

```text
same responsibility boundary run -> composite activity
```

Branching and merging require graph quotient projection.
That should be implemented after the linear semantics are stable.

```text
v0:
  linear flow projection

later:
  graph quotient projection
  branching
  merging
  parallel activities
  exception paths
```

### Assertable subset (v0)

Current v0 implements only the assertable subset of the semantic core in `docs/semantic-core.md`. It does not implement the future execution API.

- `INV-1`–`INV-6` are covered by executable `node:test` tests under `src/__tests__/`.
- Linear-only: branching, merging, cycles, multiple starts, and disconnected flows are rejected.
- `Effect` is plain, JSON-serializable data. `validateDirectedEffect` checks that the declared source boundary matches the source Activity's projection under the selected boundary, and that a directed target is a known boundary. It is not an execution API and `Effect` is not embedded in the `responsible.v0` model schema.
- No execution API: `World`, `ActivityResult`, `seq`, and runtime `requires` / `ensures` predicate checking are future semantic targets, not v0 API.
- No inverse projection API: RBNF collapse is treated as non-reversible.

The semantic vocabulary (`BoundaryId`, `ActivityId`, `SchemaRef`, `Projection`, `RBNF`, `Effect`, opaque `RequiresRef` / `EnsuresRef`) is re-exported additively from `src/index.ts` alongside the existing `model`, `boundary`, `normalize`, and `graph` APIs.

## Design constraint

The reference implementation should remain boring.

```text
plain objects
pure functions
no hidden runtime
no framework coupling
```

This keeps the model portable to other languages and makes frontend visualization a consumer of the model, not the owner of the model.
