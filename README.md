# responsible

[![CI](https://github.com/f4ah6o/responsible/actions/workflows/ci.yml/badge.svg)](https://github.com/f4ah6o/responsible/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node.js >= 22.18](https://img.shields.io/badge/node-%3E%3D22.18-brightgreen)

**Business process modeling with typed Activities and responsibility boundaries.**

English | [日本語](README.ja.md)

`responsible` models work as the composition of typed Activities — `Activity<Input, Output>` — and renders the same model at any organizational granularity by projecting it onto a chosen _responsibility boundary_. It ships as a small, dependency-free semantic core plus an interactive, node-based process viewer.

**[Live demo →](https://f4ah6o.github.io/responsible/)**

---

## Why

BPMN-style diagrams entangle three things: what the work _is_, who is _responsible_ for it, and how it is _drawn_. `responsible` separates them:

- **Activity** is the only modeling primitive: a typed business function `Input -> Output`. Gateways, triggers, and start/end events are not special entities — branching is an Activity that outputs a decision, a trigger is the output of an upstream (possibly external) Activity, and start/end are just view boundaries.
- **Responsibility** is an attribute attached to an Activity (`company / department / section / team / person`, or any axes you choose), not the structure of the model itself.
- **Views are projections.** A process diagram is computed: project the Activity graph onto a boundary, then merge consecutive same-boundary Activities (_Responsibility Boundary Normal Form_). Zooming from a person-level view to a company-level view changes the boundary, never the model.

```text
ProcessView = normalize(project(ActivityGraph, boundary))
```

One model, written once at the finest granularity you know, produces consistent views for every level of the organization — functional, hierarchical, or matrix.

## Features

- **Dependency-free semantic core** — plain data structures and pure functions (`ProcessModel -> ProcessView`), enforcing invariants `INV-1`–`INV-6`. Portable and inspectable by design.
- **DAG projection with branching and merging** — graph quotient projection (`projectDagByResponsibilityBoundary`) handles nonlinear flows; cycles are rejected with a clear error instead of crashing.
- **Boundary zoom** — step through `company < department < section < team < person` views of the same model. Distinct from viewport pan/zoom, which never changes the projection.
- **Hierarchical drill-down** — Activities nest arbitrarily; a parent is the composition of its children. Drill into any decomposition scope independently of boundary zoom.
- **Interactive viewer** — single-screen React Flow viewer with Activity nodes, responsibility lanes, cross-boundary edges, and nested lane layout.
- **Contracts and effects (`responsible.v1`)** — declare `requires` / `ensures` / `effects` on Activities. Declared effects render as node badges and dashed edges to the target boundary's lane, and hide/appear with boundary zoom under the same rule that collapses same-boundary flows.
- **Bring your own model** — load any `responsible.v0` / `responsible.v1` JSON file from the toolbar. Structural validation reports issues with JSON paths; flat models are automatically wrapped in a synthetic root. Imported models persist in `localStorage` and survive a reload; they can be removed from the toolbar.
- **Shareable URLs** — process, boundary zoom level, and drill-down scope sync to the URL hash, so a link reproduces the exact view. For an imported model, "Copy share link" compresses the model itself into the URL (`#m=`) so anyone opening the link sees the same diagram, no upload required.
- **Crash resilience** — a top-level error boundary and in-place error panels; unsupported models show a message instead of a blank screen.

## Quick start

Requirements: **Node.js >= 22.18** and **pnpm 10**.

```sh
git clone https://github.com/f4ah6o/responsible.git
cd responsible
pnpm install
pnpm dev        # viewer at http://localhost:5173
```

Other scripts:

```sh
pnpm run check      # format + lint check
pnpm run typecheck  # tsc --noEmit
pnpm test           # node:test, zero test dependencies
pnpm run build      # production build to dist/
pnpm run preview    # preview the production build
```

## Using the viewer

The viewer ships with bundled sample processes (software development, document publishing, AI agent execution, a branching/merging estimate approval flow, and a `responsible.v1` application approval flow with contracts and effects). To view your own process:

1. Write a `responsible.v0` or `responsible.v1` JSON model — start from [`examples/order-fulfillment.json`](examples/order-fulfillment.json) (v0, a six-Activity order-to-invoice process) or [`examples/application-approval.v1.json`](examples/application-approval.v1.json) (v1, with `requires` / `ensures` / `effects`).
2. Click **“JSON を読み込む”** (Load JSON) in the toolbar. The imported model is saved to `localStorage` and stays in the process list — including after a reload — until you remove it with **“このモデルを削除”** (Delete this model).
3. Use **boundary zoom** to move between organizational levels, **drill-down** to open an Activity's decomposition, and viewport pan/zoom to navigate the canvas.
4. Share the URL with **“共有リンクをコピー”** (Copy share link). For a bundled sample, `#p=…&z=…&s=…` encodes the process, zoom level, and scope. For an imported model, the model itself is deflate-compressed and embedded as `#m=…&z=…&s=…`, so opening the link in another browser reproduces the exact diagram without needing the original JSON file. Very large models are rejected with an in-toolbar warning instead of producing an unusable URL.

Invalid models are reported with JSON-path error messages. Models containing cycles load, but affected scopes display an error panel instead of a diagram. A corrupted `#m=` value (e.g. a hand-edited link) shows the same kind of error panel rather than a blank screen; a persisted model that fails to re-validate (e.g. after a future schema change) is listed as unselectable with a "読み込みエラー" (load error) marker and can be removed from the toolbar.

## Using the core

The projection and validation core has no runtime dependencies and works without the viewer:

```ts
import { parseProcessModelJson, ensureRootActivity } from "./src/index.js";

const result = parseProcessModelJson(jsonText);
if (!result.ok) {
  for (const issue of result.issues) console.error(issue.path, issue.message);
} else {
  const { model, rootActivityId } = ensureRootActivity(result.model);
  // project, normalize, render…
}
```

The core is not yet published to npm; use it in-repo or vendor `src/` (everything is re-exported from [`src/index.ts`](src/index.ts)).

## Model schema (`responsible.v0`)

```ts
type ProcessModel = {
  schemaVersion: "responsible.v0";
  activities: Record<string, ActivityDef>;
  types: Record<string, TypeDef>;
  flows: FlowDef[];
  views: ViewDef[];
};

type ActivityDef = {
  id: string;
  name?: string;
  input: TypeRef; // input data type
  output: TypeRef; // output data type
  responsibility?: Record<string, unknown>; // e.g. company/department/section/team/person
  children?: string[]; // decomposition into child Activities
  status?: "discovered" | "defined" | "validated" | "automatable";
};

type FlowDef = { from: string; to: string; mapping?: string; contract?: string };
```

The authoritative definitions live in [`src/model.ts`](src/model.ts), and structural validation in [`src/validate.ts`](src/validate.ts). See [`examples/order-fulfillment.json`](examples/order-fulfillment.json) for a complete working model.

### `responsible.v1` (contracts and effects)

`responsible.v1` extends v0 with optional declarative fields on Activities: `requires` / `ensures` (opaque fact references) and `effects` (an observable payload plus a boundary-crossing delivery rule — `directed` / `broadcast` / `observable`). v1 is a strict superset of v0: validation accepts both versions, and `migrateProcessModelToV1` upgrades a v0 document by rewriting `schemaVersion` alone. The normative design and staged plan live in [`docs/responsible-v1.md`](docs/responsible-v1.md). Declared effects are projected onto a selected boundary with `projectEffects` (`src/effects.ts`): directed effects that stay inside one boundary at the selected view are hidden as internal (`tau`), and unknown directed targets are reported as `INV-3` violations. The viewer renders observable effects as node badges and dashed cross-lane edges; see the bundled `申請承認（契約と作用）` sample.

## Documentation

| Document                                                                                                        | Contents                                                                                        |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`docs/semantic-core.md`](docs/semantic-core.md)                                                                | **Normative** semantic rules: Activity, Responsibility Boundary, Projection, RBNF, invariants   |
| [`docs/theory.md`](docs/theory.md)                                                                              | Theoretical background and how theory maps onto the implementation                              |
| [`docs/reference-implementation.md`](docs/reference-implementation.md)                                          | Scope and dependency policy of the reference implementation                                     |
| [`docs/nonlinear-projection.md`](docs/nonlinear-projection.md)                                                  | Design of the DAG graph quotient projection                                                     |
| [`docs/responsible-v1.md`](docs/responsible-v1.md)                                                              | **Normative** `responsible.v1` schema design (contracts and effects) and staged plan            |
| [`docs/loops.md`](docs/loops.md)                                                                                | **Normative** loop (cycle) projection semantics — return edges, tau-loop rule — and staged plan |
| [`docs/activity-effects.md`](docs/activity-effects.md) / [`docs/data-and-effects.md`](docs/data-and-effects.md) | Effect model: effects as plain data observable across boundaries                                |
| [`docs/research-report.md`](docs/research-report.md)                                                            | Background research (non-normative)                                                             |

## Architecture

```text
src/
  model.ts       ProcessModel / ProcessView data types (responsible.v0 / v1)
  validate.ts    structural validation, JSON parsing, synthetic-root wrapping
  migrate.ts     v0 -> v1 schema migration
  boundary.ts    responsibility-boundary resolution
  hierarchy.ts   boundary zoom levels (company … person)
  quotient.ts    DAG graph quotient projection (branch / merge)
  normalize.ts   Responsibility Boundary Normal Form
  graph.ts       flow-graph helpers
  semantic.ts    semantic-core vocabulary types, Effect, invariant helpers
  effects.ts     projection of declared v1 effects onto a boundary (projectEffects)
  viewer/        React + React Flow reference viewer
  __tests__/     node:test suites (invariants, projection, zoom, validation)
```

The **projection core** (everything outside `src/viewer/`) is dependency-free. Only the viewer depends on React and `@xyflow/react`. DSL parsing, persistence, and execution runtimes are intentionally downstream layers, out of scope for this repository.

### Non-goals

`responsible` is a semantic core and viewer. It is **not** a BPMN runtime, a RACI chart tool, an Event Sourcing runtime, an Actor runtime, or a State Machine runtime — those can be built downstream of the projection.

## Project status

Version `0.x` — the API and JSON schemas (`responsible.v0` / `responsible.v1`) may change between minor versions. The core implements the assertable subset of the semantic core: invariants `INV-1`–`INV-6`, `Effect` as plain data, DAG projection, and — with `responsible.v1` — declared contracts and boundary-projected effects per [`docs/responsible-v1.md`](docs/responsible-v1.md). There is no execution or inverse-projection API. Loop (cycle) semantics is defined in [`docs/loops.md`](docs/loops.md); until its staged implementation lands, the projector still rejects cycles.

Notable changes are tracked in [`CHANGES.md`](CHANGES.md).

## Contributing

Issues and pull requests are welcome. Before submitting a PR, please make sure the full quality gate passes locally — CI runs the same steps on every PR:

```sh
pnpm run check && pnpm run typecheck && pnpm test && pnpm run build
```

For changes to the model semantics, [`docs/semantic-core.md`](docs/semantic-core.md) is normative; please keep code, tests, and that document consistent.

## Deployment

Pushes to `main` deploy the viewer to GitHub Pages via [`.github/workflows/pages.yml`](.github/workflows/pages.yml). CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs check / typecheck / test / build on PRs and `main`.

## License

[MIT](LICENSE)
