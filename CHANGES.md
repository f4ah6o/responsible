# Changes

## Unreleased

### Added

- Document the semantic core theory, Activity effect model, RBNF definition, and v0 / future verification boundaries. (`issues/done/20260624-document-semantic-core.md`)
- Add a semantic core vocabulary type layer (`BoundaryId`, `ActivityId`, `SchemaRef`, `Projection`, `RBNF`, opaque `RequiresRef` / `EnsuresRef`), a plain-data `Effect` type, directed-effect boundary validation helpers (`validateDirectedEffect`, `knownBoundaryIds`), and leaf-scope derivation (`leafActivityIds`) to the reference implementation core, keeping runtime dependencies at zero. (`issues/polished/20260624-align-reference-impl-semantic-core.md`)
- Add a hierarchical responsibility-boundary zoom order module (`src/hierarchy.ts`) with level helpers (`HIERARCHICAL_BOUNDARY_ORDER`, `zoomLevelIndexOf`, `boundaryForLevel`, `zoomIn`, `zoomOut`, `canZoomIn`, `canZoomOut`, `clampZoomLevel`, `isHierarchicalBoundary`) re-exported from the core, plus a `node:test` suite covering hierarchical clamping, fixed scope, RBNF maintenance, and expected projection sequences for `company` / `department` / `section` / `person`. (`issues/polished/20260625-fix-boundary-zoom.md`)
- Add a zero-dependency `node:test` runner (`pnpm test`) and tests covering invariants `INV-1`–`INV-6`, v0 linear-only rejection, and the absence of an inverse-projection API. (`issues/polished/20260624-align-reference-impl-semantic-core.md`)

### Changed

- Align reference implementation zoom semantics with responsibility boundary levels instead of Activity decomposition scope. Boundary zoom now moves one step along the hierarchical order `company < department < section < team < person` over a fixed displayed-process leaf scope; Activity `children` movement is renamed to "drill-down" and exposed as a separate UI. Non-hierarchical boundaries (`function`, `role`, `system`, `[project, function]`) are moved to a separate "display axis" control. (`issues/polished/20260625-fix-boundary-zoom.md`)
- Rename the `Activity zoom` tab to `Activity decomposition` and update `docs/reference-implementation.md` to resolve the `zoom` terminology conflict with `README.md`. (`issues/polished/20260625-fix-boundary-zoom.md`)
- Document that current v0 implements only the assertable subset of the semantic core in `README.md` and `docs/reference-implementation.md`. (`issues/polished/20260624-align-reference-impl-semantic-core.md`)

### Fixed

- Resolve pre-existing `tsc --noEmit` errors in `src/boundary.ts` (readonly boundary expression narrowing) and `src/main.ts` (CSS side-effect import) so `pnpm run typecheck` passes. (`issues/polished/20260624-align-reference-impl-semantic-core.md`)

### Deprecated

### Removed

### Security

### Migration
