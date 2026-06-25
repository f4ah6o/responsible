# Reference implementation policy

The implementation in this repository is a reference implementation, not the only runtime.

The reference implementation is centered on a single-screen, node-based **business process viewer** that renders `ProcessView`: Activity nodes, responsibility-boundary Lanes, cross-boundary connections, and viewport pan / zoom. The pure projection core that produces `ProcessView` stays small enough to inspect, port, and replace.

## Dependency policy

The pure projection core stays dependency-free. The reference viewer is allowed to depend on a visualization library.

```text
core runtime dependencies: 0
viewer runtime dependencies: react, react-dom, @xyflow/react
reference language: TypeScript / JavaScript
```

The core (`src/model.ts`, `src/boundary.ts`, `src/hierarchy.ts`, `src/normalize.ts`, `src/semantic.ts`, `src/graph.ts`, `src/index.ts`) remains plain TypeScript with pure functions and plain data structures. It must not import React, Vue, Svelte, canvas libraries, graph layout engines, schema validators, or parser generators.

The core package exposes pure functions and plain data structures.

```text
ProcessModel -> ProcessView
```

The viewer consumes `ProcessView` and renders it as a node / lane UI with React Flow. The viewer is downstream of the model and never pushes visualization concerns back into the core.

## Reference implementation scope

The reference implementation covers the semantic core plus a viewer:

1. Activity model
2. Input / Output type references
3. Responsibility attributes
4. Boundary resolution
5. Responsibility Boundary Normal Form projection
6. Plain JSON-serializable view model
7. Activity `children` (read-only in the viewer Inspector; interactive drill-down is out of v0 scope)
8. Node-based process viewer (React Flow): Activity nodes, responsibility-boundary Lanes, cross-boundary connections, viewport pan / zoom, boundary zoom, and an Activity Inspector

The core should not include:

1. graph layout engines
2. BPMN runtime
3. DSL parser
4. persistence layer
5. server framework
6. validation libraries

Those can be added as separate adapters after the model stabilizes. The viewer may use React and React Flow; the core may not.

## Zoom and decomposition

Per `README.md` (`Digital zoom`, `Design principles`), **zoom means choosing a responsibility boundary level**, not moving along the Activity decomposition hierarchy. The viewer keeps three separate, non-overlapping operations:

```text
boundary zoom    = choose responsibility boundary level (hierarchical)
viewport pan/zoom = visual pan and zoom of the canvas (whole-overview vs. detail)
drill-down       = choose Activity decomposition scope (children) — not implemented in the v0 viewer
```

`boundary zoom` and `viewport pan/zoom` share the word "zoom" but are different concepts. Boundary zoom recomputes the projection at a different responsibility level over a fixed scope. Viewport pan/zoom only moves/scales the canvas and never changes the projection.

### Responsibility boundary zoom

The hierarchical responsibility boundaries are ordered from the most coarse level to the most detailed level:

```text
company < department < section < team < person
```

This ordered constant (`src/hierarchy.ts`, re-exported from `src/index.ts`) is the single source of truth for boundary zoom. Zoom in moves one step toward `person`; zoom out moves one step toward `company`. Both ends clamp, and the corresponding buttons are disabled at the ends. The viewer exposes this through a dedicated `BoundaryZoomControl`.

Zoom operates on a fixed scope. The displayed process's leaf set does not change when zooming:

```text
ProcessView = normalize(project(scope.leaves, boundaryLevel))
```

Only `boundaryLevel` changes between zoom steps. The same Activity Graph and the same displayed-process leaf set are projected at every level. For the software development sample:

```text
company view:
  Acme Software

department view:
  Product -> Engineering -> Quality -> Platform

section view:
  Product Management -> Architecture -> Application -> QA -> Release Eng
```

### Viewport pan / zoom

Viewport pan / zoom is the visual canvas operation provided by React Flow (`Controls`, `MiniMap`, and standard pan/zoom). It switches between whole-overview and detail viewing. It does **not** change the responsibility boundary level and does **not** change the projected `ProcessView`. It is independent of boundary zoom.

### Activity decomposition (children)

A parent Activity can be decomposed by `children`. The v0 viewer does **not** implement interactive drill-down / drill-out. `children` are shown read-only in the Activity Inspector. This keeps `zoom ≠ drill-down` physically separated in the v0 viewer.

```text
projection  : project(displayedProcess.leaves, boundaryLevel)   (independent of children)
inspector   : selected Activity's children, read-only
```

## Process viewer

The viewer is a single-screen, node-based business process viewer built with React Flow (`@xyflow/react`). It consumes `ProcessView` from the core and renders it without adding any semantic layer to the model.

```text
Activity    -> React Flow custom node
boundary    -> Lane (React Flow parent/group node, horizontal lanes stacked vertically)
cross-boundary transition -> edge that crosses Lanes
```

The viewer renders the normalized projected graph after same-boundary runs have been collapsed into projected nodes. Boundary values are rendered as horizontal Lanes stacked top-to-bottom in the order they first appear in the projected flow. Activity nodes are placed left-to-right by flow index; cross-boundary edges cross Lanes to make responsibility-boundary handoffs visible.

```text
layout(project(displayedProcess.leaves, boundaryLevel)) -> React Flow nodes + edges + lanes
```

The viewer also provides process selection (three construction-independent sample processes), an Activity Inspector for the selected node, viewport pan / zoom, and a separate boundary zoom control. The dependency-free SVG layout in `src/graph.ts` is kept as a public API but is no longer used by the viewer.

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
  Dependency-free graph layout (public API kept; not used by the viewer).

src/semantic.ts
  Semantic vocabulary, plain-data Effect, directed-effect validation.

src/index.ts
  Public API exports (pure projection core only).

src/sample.ts
  Three construction-independent sample ProcessModels and a registry.

src/main.tsx, src/viewer/
  React + React Flow viewer. Consumes ProcessView from the core.
  src/viewer/projectionToFlow.ts maps ProcessView to React Flow nodes/edges/lanes.
```

Future packages can split the core and the viewer once the model stabilizes.

```text
@responsible/core       pure TypeScript projection core (dependency-free)
@responsible/viewer     React + React Flow reference viewer (this in-tree viewer)
@responsible/view-json  stable view projection format
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

The pure projection core should remain boring.

```text
plain objects
pure functions
no hidden runtime
no framework coupling
```

The viewer is allowed to use React and React Flow, but the core stays portable to other languages. Frontend visualization is a consumer of the model, not the owner of the model.
