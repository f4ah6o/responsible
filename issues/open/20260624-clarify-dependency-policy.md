# Clarify dependency policy for the reference implementation

Status: open
Model: unknown
Created: 2026-06-24
Updated: 2026-06-24
Branch: docs/20260624-clarify-dependency-policy
Source:
- https://github.com/f4ah6o/responsible/issues/9

## 概要

`responsible` の仕様の言語非依存性と、リファレンス実装の依存採用基準を区別し、reference implementation の dependency policy を README または `docs/reference-implementation.md` に明記する。

## 背景

以前の指示・議論の中で、`responsible` のリファレンス実装を「依存性ゼロで作る」ように読める表現が混入していた。本来の意図は、リファレンス実装そのものを依存性ゼロに縛ることではなく、次の通りである。

- `responsible` の仕様・理論・記法は、特定のプログラミング言語や特定フレームワークに依存させない。
- リファレンス実装は、その仕様を理解・検証・可視化するための実装であり、必要な範囲で実装上の依存を持ってよい。
- 依存を減らす方針は望ましいが、仕様の言語非依存性と、実装の zero dependency は別の問題である。

## 問題

「依存性ゼロ」が実装制約として扱われると、次の問題が起きる。

1. 可視化・UI・検証体験の品質より、依存削減が優先されてしまう。
2. Vite / React / React Flow 的な graph viewer など、リファレンス実装に有用な選択肢が不必要に排除される。
3. `responsible` の中核である semantic model / responsibility boundary / activity / projection の言語非依存性という本来の目的が、実装技術選定の制約と混同される。

## 目標

次のように整理し、文書化する。

```text
responsible specification:
  - language-agnostic
  - implementation-agnostic
  - framework-agnostic
  - normative semantics live in docs / model definitions

reference implementation:
  - may use practical dependencies
  - should keep dependencies justified and replaceable
  - should not make the specification depend on its implementation stack
  - should prioritize comprehension, visualization, and validation of the semantics
```

## 対象外

- 既存実装を zero dependency にすること。
- 仕様を TypeScript / React / Vite に依存させること。
- リファレンス実装で採用したライブラリを normative な仕様要素として扱うこと。

## 提案する方針

1. README または `docs/reference-implementation.md` に dependency policy を明記する。
2. 「依存性ゼロ」という表現が既存ドキュメントや issue に残っていれば修正する。
3. リファレンス実装の依存採用基準を簡潔に書く。
   - 仕様を汚染しない。
   - 可視化・検証・開発体験に明確な価値がある。
   - semantic core と UI/framework code を分離する。
   - 将来別実装に置き換えられる構造にする。

## 受け入れ条件

- [ ] `responsible` の仕様が言語非依存であることが明記されている。
- [ ] リファレンス実装は必要な依存を許容することが明記されている。
- [ ] dependency policy が README / reference implementation docs / relevant issue comments のどこかから参照可能になっている。
- [ ] 今後の実装 issue で「依存性ゼロ」が暗黙の必須条件として扱われない状態になっている。

## テスト計画

- `pnpm run check` を実行し、既存の検査が成功することを確認する。
- README / `docs/reference-implementation.md` をレビューし、仕様の言語非依存性と実装の依存許容が混同されていないことを確認する。
- `rg -n 'zero dependency|依存性ゼロ|dependency policy' README.md docs/reference-implementation.md docs/semantic-core.md` で表現を確認する。

## リスク

- dependency policy の緩和が、semantic core に不要な実装依存を持ち込む誤読を生む。
- 既存の「依存ゼロ」主張を撤回する際に、過去の設計判断との整合性を説明する必要がある。
- 可視化ライブラリ採用を許容する表現が、core への依存混入を正当化するように読まれる可能性がある。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Clarify the dependency policy: the responsible specification remains language/framework-agnostic, while the reference implementation may use practical, justified, and replaceable dependencies for visualization and validation.

## 注記

- GitHub Issue metadata:
  - Source: https://github.com/f4ah6o/responsible/issues/9
  - Labels: none
  - GitHub createdAt: 2026-06-24T23:22:10Z
  - GitHub updatedAt: 2026-06-24T23:22:10Z
- GitHub close comment:
  - Captured as local issue. issues/open/20260624-clarify-dependency-policy.md
