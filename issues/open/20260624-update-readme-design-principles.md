# README Design principles を semantic-core に合わせて更新する

Status: open
Model: unknown
Created: 2026-06-24
Updated: 2026-06-24
Branch: docs/20260624-update-readme-design-principles
Source:
- https://github.com/f4ah6o/responsible/issues/6

## 概要

README の `Design principles` を、normative 文書となった `docs/semantic-core.md` および `docs/reference-implementation.md` と整合させる。実装変更は直接の対象にしない。

## 背景

README の `Design principles` は初期コンセプトとして大筋で有効だが、現在は `docs/semantic-core.md` が semantic core の normative document になっている。以下の設計判断が README に十分反映されていない。

- Activity を単純な `Input -> Output` 純粋関数として読むだけでは、`effects` を扱う意味論を表しきれない。
- Zoom は中心的には Responsibility Boundary の切り替えだが、reference implementation では Activity decomposition scope と Responsibility Boundary の 2 軸が整理されている。
- Projection の read-only 性、RBNF の非可逆性、Effect / Mutation の区別が Design principles に入っていない。
- v0 が linear flow の assertable subset であることが Design principles から読み取りにくい。

## 問題

README の `Design principles` が `docs/semantic-core.md` / `docs/reference-implementation.md` / `docs/activity-effects.md` / `docs/data-and-effects.md` と整合しておらず、読者が semantic core の設計判断を誤読する可能性がある。

## 目標

README の `Design principles` を現在の semantic core 文書と整合させ、v0 API と semantic target の区別、Activity zoom / Boundary zoom の分離、projection / RBNF / Effect / Mutation の語彙、v0 の linear-only 制約を明記する。

## 対象外

- `World` / `ActivityResult` / execution API の実装。
- branching / merging / parallel graph quotient projection の実装。
- DSL parser の実装。
- visualization の変更。

## 提案する方針

1. principle 2 を更新する。
   - 現在: `Activity は Input -> Output の型付き関数である。`
   - 更新案: `v0 の Activity 定義は input / output 型参照を持つ plain data である。意味論上の Activity は、model world を受け取り、output と Effect を返す effectful computation として読める。`
2. principle 11 を更新する。
   - 現在: `ズームとは責任境界を切り替えることである。`
   - 更新案: `ズームには 2 軸がある。Activity zoom = どの Activity 分解スコープを見るかを選ぶ。Boundary zoom = どの責任境界で射影するかを選ぶ。responsible の中心的なズームは Boundary zoom である。`
3. semantic-core 由来の principle を追加する。
   - Projection は read-only であり、元の ProcessModel / World / fact set を変更しない。
   - RBNF は lossy な quotient view であり、元の詳細モデルへ復元できる API を提供しない。
   - Effect は mutation ではない。Effect は Activity の結果が責任境界を越えて観測可能になることである。
   - Mutation は Activity によって引き起こされる実装内部の変化であり、semantic core の中心語彙ではない。
   - v0 は linear flow のみを対象とし、branching / merging / parallel / cycle は将来の graph quotient projection に回す。
   - Core は plain data と pure functions を基本とし、可視化・DSL・永続化・実行 runtime は下流レイヤーに置く。

## 受け入れ条件

- [ ] README の `Design principles` が `docs/semantic-core.md` と矛盾しない。
- [ ] `Activity = Input -> Output` が v0 API の簡略表現なのか semantic target なのか曖昧でなくなる。
- [ ] Activity zoom と Boundary zoom の関係が明示される。
- [ ] Projection read-only / RBNF non-reversible / Effect vs Mutation の区別が README から読める。
- [ ] 実装変更を伴わず、README 更新だけで完了できる。

## テスト計画

- `pnpm run check` を実行し、フォーマットや lint が壊れていないことを確認する。
- README の `Design principles` を `docs/semantic-core.md` / `docs/reference-implementation.md` と対照し、用語の整合性をレビューする。
- `rg -n 'Input -> Output|ズーム|Activity zoom|Boundary zoom|read-only|non-reversible|Effect|Mutation|linear flow' README.md` で各概念が記載されていることを確認する。

## リスク

- 新しい principle 追加により README が長くなり、読者の注意が散漫になる。
- `Input -> Output` の表現を変更することで、既存の README 読者が混乱する可能性がある。
- semantic core 文書との整合を取る際に、v0 API と semantic target の区別が不十分になると、実装能力を超える約束を README が暗示する恐れがある。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Update README Design principles to align with `docs/semantic-core.md`, clarifying v0 API vs semantic target, Activity zoom / Boundary zoom, projection read-onlyness, RBNF non-reversibility, Effect vs Mutation, and v0 linear-only scope.

## 注記

- GitHub Issue metadata:
  - Source: https://github.com/f4ah6o/responsible/issues/6
  - Labels: documentation, proposal
  - GitHub createdAt: 2026-06-24T15:32:19Z
  - GitHub updatedAt: 2026-06-24T15:32:19Z
- GitHub close comment:
  - Captured as local issue. issues/open/20260624-update-readme-design-principles.md
