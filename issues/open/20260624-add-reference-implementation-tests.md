# Add tests for the reference implementation core

## 概要

Add automated tests for the existing TypeScript reference implementation so that the semantic core (`model`, `boundary`, `normalize`) can be changed and reviewed safely.

## 背景

- `docs/reference-implementation.md` defines the scope and constraints of the reference implementation.
- `src/model.ts`, `src/boundary.ts`, `src/normalize.ts`, and `src/index.ts` already implement the v0 semantic core.
- The repository currently has no automated tests.
- The v0 projection is intentionally limited to linear flows and must reject branching, merging, cycles, and disconnected activities.

## 問題

Without tests, regressions in boundary resolution, linear ordering, or Responsibility Boundary Normal Form projection are only caught by manual inspection. This blocks confident refactoring of the core as the model evolves.

## 目標

Provide a minimal, fast, dependency-free test suite that exercises the public API surface and the documented v0 constraints.

## 対象外

- Visualization renderers (React, SVG, canvas).
- DSL parser or printer.
- Persistence layer.
- BPMN runtime integration.
- Graph quotient projection for branching and merging.
- Performance or load testing.

## 提案する方針

1. Add a test runner that does not introduce runtime dependencies into the core package. Prefer Node.js built-in `node:test` and `node:assert` if the active Node.js version supports them; otherwise use a small dev dependency such as `vitest` or `tape`.
2. Test `boundaryOf` and `resolveBoundaryValue` for:
   - Simple keys.
   - Nested keys using dot notation.
   - Composite boundaries (arrays of keys).
   - Missing responsibility attributes.
   - Arrays and objects as boundary values.
3. Test `projectByResponsibilityBoundary` for:
   - Linear flows with no adjacent same-boundary activities.
   - Linear flows where adjacent same-boundary activities are composed into a single composite activity.
   - Boundary changes producing multiple lanes.
   - Output view satisfying `isResponsibilityBoundaryNormalForm`.
4. Test `linearOrder` constraints:
   - Reject branching (multiple outgoing edges).
   - Reject merging (multiple incoming edges).
   - Reject cycles.
   - Reject multiple starts.
   - Reject disconnected activities.
5. Keep tests plain and deterministic; do not depend on file system, network, or global state.
6. Wire tests into `package.json` scripts (`test`, `test:watch` if appropriate).

## 受け入れ条件

- [ ] A test runner is configured without adding core runtime dependencies.
- [ ] `npm test` (or equivalent) runs all tests and exits with code 0 on the current implementation.
- [ ] `boundaryOf` behavior is covered for simple, nested, and composite boundary expressions.
- [ ] `projectByResponsibilityBoundary` produces the expected `ProcessView` for linear flows with and without adjacent same-boundary runs.
- [ ] `isResponsibilityBoundaryNormalForm` returns `true` for valid projected views.
- [ ] v0 linear-flow constraints reject branching, merging, cycles, multiple starts, and disconnected graphs with descriptive errors.
- [ ] Tests are colocated under a single directory (for example `src/__tests__/` or `tests/`) and imported paths use the public API through `src/index.ts` where possible.

## テスト計画

- Run `npm run check` to confirm TypeScript compilation still passes.
- Run `npm test` after adding tests.
- Manually review one representative test case for each public function to confirm it matches the documented behavior in `docs/reference-implementation.md` and `README.md`.
- Verify that `npm test` fails when a boundary resolution or projection rule is intentionally broken.

## リスク

- Adding a dev dependency may conflict with the dependency-light policy if not scoped to `devDependencies`. Mitigation: prefer built-in Node.js test modules.
- Tests that over-specify internal identifiers (such as composite activity ids) may break on minor refactoring. Mitigation: assert on shape and boundaries, not on generated id strings where avoidable.
- The v0 linear-only restriction is intentionally strict; tests must assert the documented errors rather than relaxing the constraint.

## 変更履歴

- `CHANGES.md` への影響: yes
- 項目案: Add automated tests for the v0 reference implementation core covering boundary resolution and Responsibility Boundary Normal Form projection.

---

- Branch: `test/20260624-add-reference-implementation-tests`
- Model: `opencode-go/kimi-k2.7-code`
