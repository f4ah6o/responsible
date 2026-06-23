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
7. Activity decomposition zoom by `children`

The core should not include:

1. React components
2. graph layout engines
3. BPMN runtime
4. DSL parser
5. persistence layer
6. server framework
7. validation libraries

Those can be added as separate adapters after the model stabilizes.

## Activity decomposition zoom

Activity zoom and responsibility-boundary zoom are separate axes.

```text
Activity zoom = choose decomposition scope
Boundary zoom = choose responsibility boundary
```

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

The UI keeps a current Activity scope. The Activity screen shows the immediate children of that scope. The Boundary projection screen projects only the leaf Activities under that scope.

```text
project(scope.children*, boundary)
```

This means the same model can be viewed in two independent directions:

```text
zoom into Activity detail
switch responsibility boundary
zoom out to parent Activity
switch responsibility boundary again
```

## Layering

```text
src/model.ts
  Data types only.

src/boundary.ts
  boundaryOf(activity, boundaryExpr).

src/normalize.ts
  Responsibility Boundary Normal Form projection.

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

## Design constraint

The reference implementation should remain boring.

```text
plain objects
pure functions
no hidden runtime
no framework coupling
```

This keeps the model portable to other languages and makes frontend visualization a consumer of the model, not the owner of the model.
