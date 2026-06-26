# Reference implementation のズームを責任境界レベルによる詳細度制御に修正する

Status: rejected
Model: GPT-5
Created: 2026-06-25
Updated: 2026-06-27
Branch: main
Source:

- https://github.com/f4ah6o/responsible/issues/1

## 概要

README で定義している `Zoom = choose boundary` の概念に合わせ、reference implementation のズーム操作を Activity 分解階層への移動ではなく、責任境界レベルによる詳細度制御へ変更する。

## 背景

- README 上のズームは Activity 階層の一部へ移動する操作ではなく、可視化に使用する責任境界を切り替える操作である。
- 期待される主可視化は、選択された責任境界レベルでレベリングされた Process View である。
- 期待モデルは `Process View = normalize(project(ActivityGraph, responsibilityBoundaryLevel))` である。
- 階層型責任境界は `company -> department -> section -> team -> person` の順序で詳細度を持つ。
- `function`、`role`、`system`、複合 boundary などの非階層軸は、責任境界の表示軸を切り替える別操作として扱う。

## 問題

現在の実装では、`focusActivityId` を変更して Activity の `children` へドリルダウンする「Activity zoom」と、`boundary` をセレクトボックスで切り替える責任境界の射影が独立している。そのため、利用者にとってのズームが Activity 分解階層による表示範囲の変更になっており、責任境界による詳細度制御という中心コンセプトを表現できていない。

## 目標

ズームイン／ズームアウトを、同じ Activity Graph と同じ表示対象プロセスのスコープに対して責任境界レベルを一段階上下させる操作として実装する。上位レベルでは同一責任境界に属する連続 Activity を合成し、下位レベルでは合成されていた Activity を下位責任境界ごとに分割する。

## 対象外

- Activity の `children` による分解階層そのものの削除。
- 非階層軸である `function`、`role`、`system`、複合 boundary を階層型ズームとして扱うこと。

## 提案する方針

1. `AppState.focusActivityId` を主可視化のズーム状態として使用している構造を見直す。
2. `leafIdsUnder(state.focusActivityId)` で射影対象を切り出している構造を見直す。
3. Activity tree と boundary projection を並列の主表示として扱っている構造を見直す。
4. `Activity zoom` という名称と操作 semantics を変更する。
5. 責任境界ズームでは、プロセス全体を同一スコープのまま保持し、`boundary` だけを階層順に変更して `projectByResponsibilityBoundary` を再実行する。
6. 現在の Boundary 選択 UI は、少なくとも階層型責任境界についてはズーム操作へ統合する。
7. 選択中 Activity は、ズーム後も対応する atomic または composite node へ追従させる。
8. Activity の `children` による分解階層は、モデリングまたはインスペクション用途として残してよいが、「ズーム」とは呼ばない。

## 受け入れ条件

- [ ] ズームイン／ズームアウトにより責任境界レベルが変わる。
- [ ] ズームしても元の Activity Graph および表示対象プロセスのスコープは変わらない。
- [ ] 各レベルで Responsibility Boundary Normal Form が維持される。
- [ ] 上位レベルでは同一責任境界の連続 Activity が合成される。
- [ ] 下位レベルでは合成 Activity がより詳細な責任境界単位へ展開される。
- [ ] サンプルモデルで `company` / `department` / `section` / `person` の表示差を確認できる。
- [ ] Activity 分解階層への移動は、責任境界ズームとは明確に分離される。

## テスト計画

- ズームイン／ズームアウトを実行し、責任境界レベルだけが一段階変わることを確認する。
- ズーム前後で Activity Graph と表示対象プロセスのスコープが変わらないことを確認する。
- `company`、`department`、`section`、`person` の各レベルで Responsibility Boundary Normal Form が維持されることを確認する。
- サンプルモデルで次の表示差を確認する。
  - `company`: `Example Construction -> Partner Company -> Example Construction`
  - `department`: `Sales Department -> Construction Department -> Administration Department`
  - `section`: `Sales Section -> Estimation Section -> Sales Section -> Construction Section -> Procurement Section -> Construction Section -> Accounting Section`
  - `person`: 各 leaf Activity が担当者単位で表示される
- Activity 分解階層への移動が、責任境界ズームとは別の操作名または別の UI として扱われることを確認する。

## リスク

- 既存の `focusActivityId` を前提にした選択状態や表示範囲制御が、責任境界ズームへの変更で破綻する可能性がある。
- 階層型責任境界と非階層 boundary 軸の UI が混在すると、操作 semantics が再び曖昧になる可能性がある。
- ズーム後の選択中 Activity 追従では、atomic node と composite node の対応規則を明確にする必要がある。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Align reference implementation zoom semantics with responsibility boundary levels instead of Activity decomposition scope.

## 注記

- 2026-06-27: Duplicate of `issues/polished/20260625-fix-boundary-zoom.md`, which carries the polished implementation-ready scope and acceptance criteria.
- Original model: `opencode-go/glm-5.2`
- GitHub Issue labels: none
- GitHub Issue createdAt: 2026-06-24T03:38:35Z
- GitHub Issue updatedAt: 2026-06-24T15:27:52Z
- クローズ時コメント: `Captured as local issue. issues/open/20260625-fix-boundary-zoom.md`
