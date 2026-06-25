# Clarify and correct irrational assumptions in docs and reference implementation

Status: open
Model: unknown
Created: 2026-06-24
Updated: 2026-06-24
Branch: docs/20260624-clarify-irrational-assumptions
Source:
- https://github.com/f4ah6o/responsible/issues/10

## 概要

`responsible` の README / docs / reference implementation / sample data に残る、実装制約や仕様命題として非合理な前提を明示し、整合性を取る。

## 背景

現状の `responsible` には、概念としては有効だが、実装制約や仕様命題として読むと非合理的になる前提がいくつか残っている。

- 仕様の言語非依存性と、リファレンス実装の zero dependency 制約が混同されている（issue #9 で整理済み）。
- Activity を単純な `Input -> Output` 純粋関数として説明しているが、semantic core では `World` / `Effect[]` を含む effectful computation として整理されている。
- `すべては Activity` というスローガンが、Boundary / Projection / Effect / RBNF を Activity に還元しすぎる読みを招く。
- `Activity は無限に入れ子にできる` が、実装上の有限 graph/tree 要件と区別されていない。
- zoom と Activity decomposition / drill-down の区別が README の原則だけでは読み取りにくい。
- RBNF が unique canonical normal form のように読めるが、現状は lossy quotient view / projection として扱うべき。
- issue #8 では「建設会社のプロセスを題材にしない」「3種類のプロセスを実装」としているが、現在の `src/sample.ts` は建設会社風の単一サンプルである。

## 問題

README / docs / implementation policy / sample data の間で、以下の不合理な前提が混在している。

1. **Dependency policy の混同**: 仕様の言語非依存性とリファレンス実装の zero dependency が分離されていない。
2. **Activity = `Input -> Output` の単純化**: v0 API の plain data と semantic target の effectful computation が区別されていない。
3. **「すべては Activity」の過剰適用**: Boundary / Projection / Effect / RBNF まで Activity に還元される読みが残っている。
4. **Infinite nesting の読み替え**: 概念上の再帰的分解可能性と、有限な ProcessModel 実装が区別されていない。
5. **Zoom と drill-down の区別**: README では `Zoom = choose boundary` と説明しているが、reference implementation では Activity zoom と Boundary zoom の 2 軸がある。
6. **RBNF の厳密化**: RBNF は unique canonical normal form ではなく、selected boundary による lossy quotient view / projection として扱うべき。
7. **Sample process の不整合**: `src/sample.ts` が建設会社風の単一サンプルであり、issue #8 の 3 サンプル方針と一致していない。

## 目標

README / docs / reference implementation / sample data の間で、以下を整合させる。

- 仕様の言語非依存性と実装の依存採用基準を分離する（issue #9 と整合）。
- README の Design principles を `docs/semantic-core.md` に合わせて更新する（issue #6 と整合）。
- `Activity = Input -> Output` を v0 API と semantic target に分けて説明する。
- `すべては Activity` を中心概念としての表現に弱め、Boundary / Projection / Effect / RBNF を別語彙として明示する。
- `Activity は無限に入れ子` を recursive decomposition / finite ProcessModel として説明し直す。
- zoom と drill-down を明確に分離する。
- RBNF を lossy quotient view / projection として表現し、unique canonical normal form の誤読を避ける。
- `src/sample.ts` を issue #8 の方針に合わせ、建設会社風単一サンプルから 3 種類のサンプルプロセスへ差し替える。
- semantic core と reference viewer の layering を明記する。

## 対象外

- `World` / `ActivityResult` execution API を今すぐ実装すること。
- branching / merging / parallel graph quotient projection を v0 に入れること。
- BPMN runtime / RACI tool / state machine runtime に寄せること。
- リファレンス実装を zero dependency に戻すこと。

## 提案する方針

1. README の Design principles を `docs/semantic-core.md` に合わせて更新する。
2. `Activity = Input -> Output` を v0 API と semantic target に分けて説明する。
3. `すべては Activity` を中心概念としての表現に弱め、Boundary / Projection / Effect / RBNF を別語彙として明示する。
4. `Activity は無限に入れ子` を recursive decomposition / finite ProcessModel として説明し直す。
5. zoom と drill-down を明確に分離する。
6. RBNF を lossy quotient view / projection として表現し、unique canonical normal form の誤読を避ける。
7. dependency policy を issue #9 の方針と整合させる。
8. `src/sample.ts` を issue #8 の方針に合わせ、建設会社風単一サンプルから 3 種類のサンプルプロセスへ差し替える。
9. semantic core と reference viewer の layering を明記する。

## 受け入れ条件

- [ ] README / docs / implementation policy の間で、仕様の言語非依存性と実装の依存採用基準が混同されていない。
- [ ] README の Design principles が `docs/semantic-core.md` と矛盾していない。
- [ ] Activity の説明が v0 plain data と future semantic target を区別している。
- [ ] RBNF が non-reversible / lossy projection として説明されている。
- [ ] zoom と drill-down が UI・用語上で分離されている。
- [ ] sample process が issue #8 の方針と一致している。

## テスト計画

- `pnpm run check` を実行し、既存の検査（型を含む）が成功することを確認する。
- `pnpm run typecheck` を実行し、TypeScript が通ることを確認する。
- `pnpm test` を実行し、既存テスト（`src/__tests__/`、特に `boundary-zoom.test.ts` / `projection.test.ts` / `invariants.test.ts` / `semantic.test.ts`）が緑であることを確認する。
- README / `docs/reference-implementation.md` / `docs/semantic-core.md` をレビューし、不合理な前提が残っていないことを確認する。
- `src/sample.ts` のサンプル置換後、viewer が正しく表示され、テスト期待値が更新されていることを確認する。
- `rg -n 'Input -> Output|すべては Activity|無限に入れ子|zoom|drill-down|RBNF|normal form|zero dependency|建設|construction' README.md docs/ src/sample.ts` で表現を確認する。

## リスク

- 複数の文書と sample data を同時に変更するため、整合性が一時的に失われる可能性がある。
- 建設会社風サンプルの置換により、`src/__tests__/boundary-zoom.test.ts` などの期待値を更新する必要がある。
- 「すべては Activity」や「無限に入れ子」などのキャッチーな表現を弱めると、README の読みやすさが損なわれる。
- RBNF の説明を厳密化すると、v0 の実装能力を超える約束を文書が暗示しないよう注意が必要。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Clarify and correct irrational assumptions across README, docs, reference implementation, and sample data. Align dependency policy with issue #9, Design principles with issue #6, sample processes with issue #8, and RBNF semantics with `docs/semantic-core.md`.

## 注記

- 関連: [[20260624-clarify-dependency-policy]]（issue #9 由来、dependency policy の整理）、[[20260624-update-readme-design-principles]]（issue #6 由来、README Design principles の更新）、[[20260625-rebuild-process-viewer]]（issue #8 由来、viewer / sample 方針）。
- GitHub Issue metadata:
  - Source: https://github.com/f4ah6o/responsible/issues/10
  - Labels: documentation, design
  - GitHub createdAt: 2026-06-24T23:27:32Z
  - GitHub updatedAt: 2026-06-24T23:27:32Z
- GitHub close comment:
  - Captured as local issue. issues/open/20260624-clarify-irrational-assumptions.md
