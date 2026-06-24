# reference implementation を semantic-core v0 の意味論へ整合させる

Status: open
Model: claude-opus-4-8
Created: 2026-06-24
Updated: 2026-06-24
Branch: refactor/4-align-reference-impl-semantic-core
Source:

- https://github.com/f4ah6o/responsible/issues/4

## 概要

`docs/semantic-core.md` を正典として、TypeScript の reference implementation を再構成し、v0 のランタイムチェックとして記述済みの意味論的規則を実装が表明できる状態にする。

## 背景

- `docs/semantic-core.md` が semantic core の規範文書である。
- 現行の reference implementation は `docs/reference-implementation.md` に記述された小規模な TypeScript モデルで、平坦なデータ構造、純粋関数、`ProcessModel -> ProcessView` projection を中心とする。
- 本作業は v0 スコープ内に留め、将来の `World` / `ActivityResult` API へ直接移行しない。現行実装が v0 ランタイムチェックとして記述済みの意味論的規則を表明できることを目標とする。

## 問題

reference implementation が semantic core の語彙と不変条件を表現しておらず、`docs/semantic-core.md` を正典として参照する忠実な実装になっていない。Activity 合成、mutation・ensures・effects の区別、read-only projection、RBNF の lossy quotient view、v0 の linear-flow 制限といった意味論が、コードとして表明・検証できない。

## 目標

reference implementation を semantic core に整合させ、次を表現可能にする。

- Responsibility Boundary 内での Activity 合成
- mutation、ensures、effects の明示的な区別
- read-only 操作としての boundary projection
- lossy boundary-projected quotient view としての RBNF
- v0 の linear-flow 制限
- `docs/semantic-core.md` 由来の表明可能な不変条件

## 対象外

- React、graph layout ライブラリ、parser generator、schema validator、persistence、server framework 依存の導入。
- 将来の `World` / `ActivityResult` 実行 API を主たる公開 API として実装すること。小さな互換レイヤとして留められる場合を除く。
- 静的な Hoare 流証明（`ensures_A => requires_B` の静的証明）。これは明示的に将来作業とする。
- branching / merging / parallel の quotient minimization。
- 一般の weak bisimulation minimization。

## 提案する方針

### 1. コアを単純に保つ

reference implementation の制約を維持する。

- 平坦な TypeScript / JavaScript
- コアにランタイム依存なし
- 純粋な projection 関数
- 可能な限り JSON シリアライズ可能なモデルとビュー値
- 可視化はモデルの下流に留める

### 2. 意味論的型を明示する

概念を混同せず意味論語彙を表現できるよう、コア型を更新または追加する。

- `Activity`
- `ResponsibilityBoundary` / `BoundaryId`
- `Projection`
- `RBNF`
- `requires`
- `ensures`
- `effects`
- `mutation`

v0 では `requires` と `ensures` は不透明なランタイム述語または述語参照のままでよい。

### 3. effect モデルを追加する

`docs/semantic-core.md` に基づく `Effect` 値モデルを導入する。

```ts
type Effect = {
  source: {
    activityId: ActivityId;
    boundary: BoundaryId;
  };
  payload:
    | { kind: "domain-fact"; schema: SchemaRef }
    | { kind: "command"; schema: SchemaRef }
    | { kind: "data"; schema: SchemaRef };
  delivery:
    | { mode: "directed"; target: BoundaryId }
    | { mode: "broadcast" }
    | { mode: "observable" };
};
```

`Effect` は実装ローカルな mutation を意味してはならない。mutation は Activity 実行 / model-world 更新の内部に留まる。Effect は Responsibility Boundary を跨いで観測可能になる結果を意味する。

### 4. projection の意味論を維持する

`projectByResponsibilityBoundary(model, view)` を v0 の具体的な projection 関数として維持しつつ、その挙動を semantic core に照らして見直す。

- projection は元の `ProcessModel` を変更してはならない。
- projection は選択された Activity スコープ内の leaf Activity から行う。
- 同一 boundary 内のステップは `tau` として扱う。
- boundary を跨ぐ effect は observable action とする。
- 連続する `tau` ステップは v0 linear flow で collapse する。
- collapse された RBNF view は lossy で不可逆である。
- RBNF view から元の詳細モデルを復元すると主張する API を設けてはならない。

### 5. 意味論的検証を追加する

`docs/semantic-core.md` に列挙された不変条件に対する検証ヘルパとテストを追加する。

- `INV-1`: View projection は `ProcessModel`、`World`、Activity 定義、source fact を変更してはならない。
- `INV-2`: mutation は Activity 実行が原因であり、その Activity の world 更新の内部に留まらなければならない。
- `INV-3`: directed effect は既知の source boundary と既知の target boundary を持たなければならない。
- `INV-4`: boundary projection は選択された Activity スコープ内の leaf Activity から行わなければならない。
- `INV-5`: RBNF collapse は不可逆として扱い、collapse された view からの可逆復元を主張する API を設けてはならない。
- `INV-6`: Activity 合成は Activity を返し、親子 Activity の合成可能性を維持しなければならない。

### 6. v0 は linear のみに保つ

一般の weak bisimulation minimization は実装しない。v0 は branching、merging、cycle、disconnected flow、parallel graph を引き続き拒否または明示的に失敗させる。将来の graph quotient projection は本 Issue のスコープ外とする。

## 受け入れ条件

- [ ] 公開コア API が `docs/semantic-core.md` の意味論語に沿って再構成されている。
- [ ] reference implementation のコアにランタイム依存がゼロのままである。
- [ ] `projectByResponsibilityBoundary` が read-only のままで、source model の不変性を証明するテストがある。
- [ ] RBNF projection が v0 linear flow で同一 boundary の連続を引き続き collapse する。
- [ ] directed effect の source / target 検証を網羅するテストがある。
- [ ] branching、merging、cycle、disconnected flow を v0 が拒否することを網羅するテストがある。
- [ ] restore / inverse projection API が存在せず export もされていないことを網羅するテストがある。
- [ ] 現行 v0 が semantic core の表明可能な部分集合のみを実装している旨を README または docs が説明している。

## テスト計画

- source model の不変性（`INV-1`）を検証するテストを追加し、projection 前後で `ProcessModel` が等価であることを確認する。
- directed effect の source / target 検証（`INV-3`）のテストを追加する。
- v0 が branching、merging、cycle、multiple starts、disconnected flow を拒否することのテストを追加する。
- restore / inverse projection API が export されていないことを確認するテストを追加する。
- `npm run check`（または `pnpm run check`）で TypeScript コンパイルが通ることを確認する。
- テスト一式を実行し、コア追加・再構成後も全テストが通ることを確認する。

## リスク

- 公開コア API の再構成は、`docs/reference-implementation.md` の記述や既存の利用箇所との不整合を生む可能性がある。docs を同時に更新して整合を保つ。
- `Effect` の delivery / payload モデル化が semantic core の意図とずれると、後続の検証が誤った前提に立つ。`docs/semantic-core.md` を逐次参照して整合を確認する。
- v0 の linear-only 制限は意図的に厳格である。テストは制限を緩めず、文書化された失敗を表明する。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- reference implementation を semantic-core v0 の意味論へ整合させ、Activity 合成、effect モデル、read-only projection、RBNF lossy collapse、表明可能な不変条件（INV-1〜INV-6）を導入する。公開コア API は semantic core の語彙に沿って再構成する。

## 注記

- 関連: [[20260624-add-reference-implementation-tests]]（reference implementation コアのテスト整備）、[[20260624-document-semantic-core]]（semantic core 文書の整備、Issue #2 由来）。
- GitHub labels: なし。
- GitHub createdAt: 2026-06-24T14:13:14Z / updatedAt: 2026-06-24T14:17:22Z。
- GitHub close comment: `Captured as local issue. issues/open/20260624-align-reference-impl-semantic-core.md`
