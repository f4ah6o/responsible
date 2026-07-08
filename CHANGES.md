# Changes

## Unreleased

### Added

### Changed

### Fixed

### Deprecated

### Removed

### Security

### Migration

## 0.1.0 - 2026-07-08

### Added

- Add a `.github/workflows/release.yml` `workflow_dispatch` workflow that runs the quality gate, verifies the input version against `package.json`, extracts the matching `CHANGES.md` section (`tools/extract-changelog.mjs`), tags and pushes `v<version>`, creates a GitHub Release from the extracted notes, and publishes to npm only when the `NPM_TOKEN` repository secret is set. Documents the release procedure in `docs/release.md` / `docs/release.ja.md`, linked from the README Contributing sections. (#29)
- Add a dependency-free `responsible` CLI (`src/cli.ts`, `node:util` `parseArgs` only) with `validate` / `migrate` / `project` subcommands over the existing core API (`parseProcessModelJson`, `ensureRootActivity`, `migrateProcessModelToV1`, `projectDagByResponsibilityBoundary`): normal output (migrated/projected JSON) goes to stdout, diagnostics (JSON-path validation issues, `ok <file>`) go to stderr, and `project --boundary` is checked against `HIERARCHICAL_BOUNDARY_ORDER`. Exposed via `package.json` `bin` (`responsible` → `dist-lib/cli.js`, built by the existing `build:lib`) so `npx responsible …` works from an installed package; `src/__tests__/cli.test.ts` exercises all three subcommands, a broken model, a missing file, an invalid boundary, and the no-args/`--help` usage output as subprocesses. (#23)

- Add hand-written JSON Schema (draft 2020-12) files for `responsible.v0` / `responsible.v1` (`schemas/`), published via GitHub Pages at `https://f4ah6o.github.io/responsible/schemas/responsible.v0.schema.json` and `…/responsible.v1.schema.json` (synced into `public/schemas/` by `tools/sync-schemas.mjs`, run as part of `pnpm run build`) so editors can offer key completion and inline validation while hand-writing a model. The schemas are stricter than `validateProcessModel` on unknown keys but don't express referential checks (`ActivityDef.id` vs. its key, `flows` endpoints, decomposition cycles); the runtime validator remains authoritative, and it accepts and ignores a `$schema` property. Adds `src/__tests__/schema.test.ts` (ajv, devDependency-only) checking schema conformance for `examples/*.json` and every bundled sample, rejection of representative invalid models by both the schema and `validateProcessModel`, and that `public/schemas/` mirrors `schemas/`. Adds `$schema` to both example files and an "Authoring models" README section (`README.md`, `README.ja.md`).
- Define loop (cycle) projection semantics as a normative document pair (`docs/loops.md`, `docs/loops.ja.md`): cycle-tolerant quotient partitioning, a canonical order via SCC condensation of the projected graph, derived return edges (`ProjectedFlow` `kind: "return"`), the tau-loop visibility rule (a loop closed inside one boundary at the selected view is invisible there), self-loop rejection, the status of `INV-1`–`INV-8` under loops plus new `INV-9` / `INV-10`, a complete rework (差し戻し) example with expected projections per boundary level, and a staged implementation plan with follow-up issues (#31–#33). No model schema change — loops stay a projection capability over `responsible.v0` / `responsible.v1` data.
- Expand composite Activity nodes in the viewer: a folded same-boundary composite (e.g. `申請を審査する + 申請を承認する` at the department/section boundary) now shows a `内訳を表示` toggle that reveals each merged Activity in place — name, finer-grained responsibility path (`… / 審査チーム / 田中`), input → output, and per-member effects — so a fold that a coarser boundary collapses can be inspected without changing the projection. In measured (`計測`) height mode the lanes reflow to fit; the projection core is unchanged. (`src/viewer/ActivityNode.tsx`, `src/viewer/projectionToFlow.ts`)
- Define the `responsible.v1` schema — declarative `requires` / `ensures` (opaque fact references) and `effects` (payload + boundary-crossing delivery rule) on Activities — as a normative document with a staged implementation plan (`docs/responsible-v1.md`, ja pair), plus follow-up issues for effect projection and viewer rendering (`issues/done/`).
- Render declared v1 effects in the viewer (stage 3): observable effects appear as badges on Activity nodes and directed effects as dashed edges to the resolved target boundary's lane, hiding and appearing with boundary zoom per the tau rule; `INV-3` issues show as a non-blocking notice. Adds the `申請承認（契約と作用）` sample process and `examples/application-approval.v1.json`; the JSON loader accepts both schema versions. (`issues/done/20260706-render-effects-in-viewer.md`)
- Implement v1 effect projection (stage 2): `projectEffects` (`src/effects.ts`) instantiates declared effects at a selected boundary — sources derived from the declaring Activity, directed targets resolved via `boundaryOfResponsibility`, same-boundary directed effects hidden as internal (`tau`) per the RBNF-consistent crossing rule, and unknown directed targets reported as `INV-3` violations with JSON paths — with `node:test` coverage. (`issues/done/20260706-project-effects-across-boundaries.md`)
- Implement the v1 schema core (stage 1): `FactRef` / `EffectDef` model types, dual-version (`responsible.v0` / `responsible.v1`) structural validation with JSON-path issues and a version hint when v1 fields appear in v0 documents, and `migrateProcessModelToV1` (v0 is a strict subset; the migration rewrites `schemaVersion` only), with `node:test` coverage. (`issues/done/20260706-implement-v1-schema-core.md`)
- Add a dependency-free model validation module (`src/validate.ts`): `validateProcessModel` (structural shape, referential integrity of flows / children, decomposition-cycle detection, JSON-path issue reporting), `parseProcessModelJson`, `inferRootActivityId`, and `ensureRootActivity` (synthetic-root wrapping for flat models), all exported from the core with `node:test` coverage.
- Add viewer JSON model import (`src/viewer/ModelLoader.tsx`): load a `responsible.v0` JSON file from the toolbar; imported processes join the process selector and share boundary zoom / drill-down / URL state. Validation issues are shown with JSON paths, and a bundled example is provided at `examples/order-fulfillment.json`.
- Sync viewer state (process, boundary zoom level, decomposition scope path) to the URL hash (`src/viewer/urlState.ts`) so views are shareable and restored on reload.
- Add crash resilience: a top-level React `ErrorBoundary` with a reload action, and in-place error panels for projection limits so the viewer never blank-screens.
- Implement nonlinear graph quotient projection (`projectDagByResponsibilityBoundary` in `src/quotient.ts`) per `docs/nonlinear-projection.md`: branching and merging over DAGs, weak-connectivity partitioning of same-boundary components, deduplicated cross-component flows, product-style entry/exit type composition, and explicit rejection of cycles and disconnected scopes. Linear flows remain a byte-identical special case of the retained v0 linear projector, covered by a `node:test` suite including `INV-7` / `INV-8` scenarios.
- Add a fourth sample process `見積承認（分岐・合流）` exercising branch and merge at every boundary zoom level, and switch the viewer to the DAG projector.
- Render cross-boundary flow edges in the viewer: activity nodes now carry React Flow connection handles (edges previously could not attach to the custom nodes and were silently dropped).

- Add runtime dependencies `react`, `react-dom`, `@xyflow/react` for the reference process viewer; the pure projection core stays dependency-free. (`issues/done/20260625-rebuild-process-viewer.md`)
- Document the semantic core theory, Activity effect model, RBNF definition, and v0 / future verification boundaries. (`issues/done/20260624-document-semantic-core.md`)
- Add a semantic core vocabulary type layer (`BoundaryId`, `ActivityId`, `SchemaRef`, `Projection`, `RBNF`, opaque `RequiresRef` / `EnsuresRef`), a plain-data `Effect` type, directed-effect boundary validation helpers (`validateDirectedEffect`, `knownBoundaryIds`), and leaf-scope derivation (`leafActivityIds`) to the reference implementation core, keeping runtime dependencies at zero. (`issues/done/20260624-align-reference-impl-semantic-core.md`)
- Add a hierarchical responsibility-boundary zoom order module (`src/hierarchy.ts`) with level helpers (`HIERARCHICAL_BOUNDARY_ORDER`, `zoomLevelIndexOf`, `boundaryForLevel`, `zoomIn`, `zoomOut`, `canZoomIn`, `canZoomOut`, `clampZoomLevel`, `isHierarchicalBoundary`) re-exported from the core, plus a `node:test` suite covering hierarchical clamping, fixed scope, RBNF maintenance, and expected projection sequences for `company` / `department` / `section` / `person`. (`issues/done/20260625-fix-boundary-zoom.md`)
- Add a zero-dependency `node:test` runner (`pnpm test`) and tests covering invariants `INV-1`–`INV-6`, v0 linear-only rejection, and the absence of an inverse-projection API. (`issues/done/20260624-align-reference-impl-semantic-core.md`)
- Add `format` and `format:check` scripts backed by Vite Plus so formatting can be checked and applied with explicit commands. (`issues/done/20260624-add-formatter-config.md`)
- Add a CI quality gate workflow for pull requests and pushes to `main`, running check, typecheck, tests, and build with read-only repository permissions. (`issues/done/20260702-add-ci-quality-gate.md`)
- Add a nonlinear graph quotient projection design document for future branching and merging support. (`issues/done/20260702-design-nonlinear-projection.md`)

### Changed

- Pin dev dependency ranges (`@types/node`, `typescript`, `vite-plus`) instead of `latest` for reproducible installs; bump package version to `0.1.0`.
- Document quickstart commands, model import, URL sharing, and the validation API in `README.md`; document the validation layer and viewer import in `docs/reference-implementation.md`.
- Rebuild the reference implementation around a single-screen, node-based business process viewer (React Flow) that consumes `ProcessView` (Activity nodes, responsibility-boundary Lanes, cross-boundary connections, viewport pan / zoom); keep the responsibility-boundary zoom from `af1611c` as a separate control. (`issues/done/20260625-rebuild-process-viewer.md`)
- Replace the construction-company sample with three construction-independent process samples (software development / document publishing / AI agent execution) and update `boundary-zoom` test expectations accordingly. (`issues/done/20260625-rebuild-process-viewer.md`)
- Revise `docs/reference-implementation.md` (reference-implementation definition and Dependency policy) and README to center the reference implementation on the viewer, allow visualization-library dependencies in the reference implementation, and distinguish boundary zoom from viewport pan / zoom. (`issues/done/20260625-rebuild-process-viewer.md`)
- Align reference implementation zoom semantics with responsibility boundary levels instead of Activity decomposition scope. Boundary zoom now moves one step along the hierarchical order `company < department < section < team < person` over a fixed displayed-process leaf scope; Activity `children` movement is renamed to "drill-down" and exposed as a separate UI. Non-hierarchical boundaries (`function`, `role`, `system`, `[project, function]`) are moved to a separate "display axis" control. (`issues/done/20260625-fix-boundary-zoom.md`)
- Rename the `Activity zoom` tab to `Activity decomposition` and update `docs/reference-implementation.md` to resolve the `zoom` terminology conflict with `README.md`. (`issues/done/20260625-fix-boundary-zoom.md`)
- Document that current v0 implements only the assertable subset of the semantic core in `README.md` and `docs/reference-implementation.md`. (`issues/done/20260624-align-reference-impl-semantic-core.md`)
- Add interactive drill-down / drill-out to the reference viewer so the displayed-process scope can move through Activity `children` independently of boundary zoom and viewport pan / zoom. (`issues/done/20260702-add-viewer-drill-down.md`)
- Clarify the README design principles around semantic target vs v0 API, read-only projection, non-reversible RBNF, and Effect vs mutation. (`issues/done/20260624-update-readme-design-principles.md`)

### Fixed

- Untangle directed-effect edges in the viewer: effect edges now leave the source node from a dedicated left-side handle and route to the target lane with orthogonal (`smoothstep`) routing, so they run along the left gutter instead of wrapping around from the right-hand flow handle and crossing the diagram. (`src/viewer/ActivityNode.tsx`, `src/viewer/projectionToFlow.ts`)
- Resolve pre-existing `tsc --noEmit` errors in `src/boundary.ts` (readonly boundary expression narrowing) and `src/main.ts` (CSS side-effect import) so `pnpm run typecheck` passes. (`issues/done/20260624-align-reference-impl-semantic-core.md`)

### Deprecated

### Removed

### Security

### Migration
