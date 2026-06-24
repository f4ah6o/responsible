# Changes

## Unreleased

### Added

- Document the semantic core theory, Activity effect model, RBNF definition, and v0 / future verification boundaries. (`issues/done/20260624-document-semantic-core.md`)
- Add a semantic core vocabulary type layer (`BoundaryId`, `ActivityId`, `SchemaRef`, `Projection`, `RBNF`, opaque `RequiresRef` / `EnsuresRef`), a plain-data `Effect` type, directed-effect boundary validation helpers (`validateDirectedEffect`, `knownBoundaryIds`), and leaf-scope derivation (`leafActivityIds`) to the reference implementation core, keeping runtime dependencies at zero. (`issues/polished/20260624-align-reference-impl-semantic-core.md`)
- Add a zero-dependency `node:test` runner (`pnpm test`) and tests covering invariants `INV-1`–`INV-6`, v0 linear-only rejection, and the absence of an inverse-projection API. (`issues/polished/20260624-align-reference-impl-semantic-core.md`)

### Changed

- Document that current v0 implements only the assertable subset of the semantic core in `README.md` and `docs/reference-implementation.md`. (`issues/polished/20260624-align-reference-impl-semantic-core.md`)

### Fixed

- Resolve pre-existing `tsc --noEmit` errors in `src/boundary.ts` (readonly boundary expression narrowing) and `src/main.ts` (CSS side-effect import) so `pnpm run typecheck` passes. (`issues/polished/20260624-align-reference-impl-semantic-core.md`)

### Deprecated

### Removed

### Security

### Migration
