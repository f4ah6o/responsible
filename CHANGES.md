# Changes

## Unreleased

### Added

- Add a dependency-free model validation module (`src/validate.ts`): `validateProcessModel` (structural shape, referential integrity of flows / children, decomposition-cycle detection, JSON-path issue reporting), `parseProcessModelJson`, `inferRootActivityId`, and `ensureRootActivity` (synthetic-root wrapping for flat models), all exported from the core with `node:test` coverage.
- Add viewer JSON model import (`src/viewer/ModelLoader.tsx`): load a `responsible.v0` JSON file from the toolbar; imported processes join the process selector and share boundary zoom / drill-down / URL state. Validation issues are shown with JSON paths, and a bundled example is provided at `examples/order-fulfillment.json`.
- Sync viewer state (process, boundary zoom level, decomposition scope path) to the URL hash (`src/viewer/urlState.ts`) so views are shareable and restored on reload.
- Add crash resilience: a top-level React `ErrorBoundary` with a reload action, and in-place error panels for v0 projection limits (e.g. nonlinear imported models) so the viewer never blank-screens.

- Add runtime dependencies `react`, `react-dom`, `@xyflow/react` for the reference process viewer; the pure projection core stays dependency-free. (`issues/polished/20260625-rebuild-process-viewer.md`)
- Document the semantic core theory, Activity effect model, RBNF definition, and v0 / future verification boundaries. (`issues/done/20260624-document-semantic-core.md`)
- Add a semantic core vocabulary type layer (`BoundaryId`, `ActivityId`, `SchemaRef`, `Projection`, `RBNF`, opaque `RequiresRef` / `EnsuresRef`), a plain-data `Effect` type, directed-effect boundary validation helpers (`validateDirectedEffect`, `knownBoundaryIds`), and leaf-scope derivation (`leafActivityIds`) to the reference implementation core, keeping runtime dependencies at zero. (`issues/polished/20260624-align-reference-impl-semantic-core.md`)
- Add a hierarchical responsibility-boundary zoom order module (`src/hierarchy.ts`) with level helpers (`HIERARCHICAL_BOUNDARY_ORDER`, `zoomLevelIndexOf`, `boundaryForLevel`, `zoomIn`, `zoomOut`, `canZoomIn`, `canZoomOut`, `clampZoomLevel`, `isHierarchicalBoundary`) re-exported from the core, plus a `node:test` suite covering hierarchical clamping, fixed scope, RBNF maintenance, and expected projection sequences for `company` / `department` / `section` / `person`. (`issues/polished/20260625-fix-boundary-zoom.md`)
- Add a zero-dependency `node:test` runner (`pnpm test`) and tests covering invariants `INV-1`–`INV-6`, v0 linear-only rejection, and the absence of an inverse-projection API. (`issues/polished/20260624-align-reference-impl-semantic-core.md`)
- Add `format` and `format:check` scripts backed by Vite Plus so formatting can be checked and applied with explicit commands. (`issues/polished/20260624-add-formatter-config.md`)
- Add a CI quality gate workflow for pull requests and pushes to `main`, running check, typecheck, tests, and build with read-only repository permissions. (`issues/polished/20260702-add-ci-quality-gate.md`)
- Add a nonlinear graph quotient projection design document for future branching and merging support. (`issues/polished/20260702-design-nonlinear-projection.md`)

### Changed

- Pin dev dependency ranges (`@types/node`, `typescript`, `vite-plus`) instead of `latest` for reproducible installs; bump package version to `0.1.0`.
- Document quickstart commands, model import, URL sharing, and the validation API in `README.md`; document the validation layer and viewer import in `docs/reference-implementation.md`.
- Rebuild the reference implementation around a single-screen, node-based business process viewer (React Flow) that consumes `ProcessView` (Activity nodes, responsibility-boundary Lanes, cross-boundary connections, viewport pan / zoom); keep the responsibility-boundary zoom from `af1611c` as a separate control. (`issues/polished/20260625-rebuild-process-viewer.md`)
- Replace the construction-company sample with three construction-independent process samples (software development / document publishing / AI agent execution) and update `boundary-zoom` test expectations accordingly. (`issues/polished/20260625-rebuild-process-viewer.md`)
- Revise `docs/reference-implementation.md` (reference-implementation definition and Dependency policy) and README to center the reference implementation on the viewer, allow visualization-library dependencies in the reference implementation, and distinguish boundary zoom from viewport pan / zoom. (`issues/polished/20260625-rebuild-process-viewer.md`)
- Align reference implementation zoom semantics with responsibility boundary levels instead of Activity decomposition scope. Boundary zoom now moves one step along the hierarchical order `company < department < section < team < person` over a fixed displayed-process leaf scope; Activity `children` movement is renamed to "drill-down" and exposed as a separate UI. Non-hierarchical boundaries (`function`, `role`, `system`, `[project, function]`) are moved to a separate "display axis" control. (`issues/polished/20260625-fix-boundary-zoom.md`)
- Rename the `Activity zoom` tab to `Activity decomposition` and update `docs/reference-implementation.md` to resolve the `zoom` terminology conflict with `README.md`. (`issues/polished/20260625-fix-boundary-zoom.md`)
- Document that current v0 implements only the assertable subset of the semantic core in `README.md` and `docs/reference-implementation.md`. (`issues/polished/20260624-align-reference-impl-semantic-core.md`)
- Add interactive drill-down / drill-out to the reference viewer so the displayed-process scope can move through Activity `children` independently of boundary zoom and viewport pan / zoom. (`issues/polished/20260702-add-viewer-drill-down.md`)
- Clarify the README design principles around semantic target vs v0 API, read-only projection, non-reversible RBNF, and Effect vs mutation. (`issues/polished/20260624-update-readme-design-principles.md`)

### Fixed

- Resolve pre-existing `tsc --noEmit` errors in `src/boundary.ts` (readonly boundary expression narrowing) and `src/main.ts` (CSS side-effect import) so `pnpm run typecheck` passes. (`issues/polished/20260624-align-reference-impl-semantic-core.md`)

### Deprecated

### Removed

### Security

### Migration
