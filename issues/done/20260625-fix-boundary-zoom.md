# Reference implementation のズームを責任境界レベルによる詳細度制御に修正する

Status: done
Model: GPT-5
Created: 2026-06-25
Updated: 2026-07-03
Branch: fix-boundary-zoom
Source:

- https://github.com/f4ah6o/responsible/issues/1

## 概要

README の `Digital zoom`（`Zoom = choose boundary`）および `Design principles` 11「ズームとは責任境界を切り替えることである」に合わせ、reference implementation のズーム操作を Activity 分解階層（`children`）への移動ではなく、責任境界レベルによる詳細度制御へ変更する。

## 背景

- README の `Digital zoom` / `Projection` は、ズームを Activity 階層への移動ではなく、可視化に使用する責任境界を切り替える操作として定義している（`README.md:206-265`）。
- 期待される主可視化は、選択された責任境界レベルでレベリングされた Process View であり、期待モデルは `Process View = normalize(project(ActivityGraph, responsibilityBoundaryLevel))` である（`README.md:238-244`）。
- 階層型責任境界は `company -> department -> section -> team -> person` の順序で詳細度を持つ（README `Hierarchical organization`、`README.md:317-324` の逆順）。
- `function`、`role`、`system`、複合 boundary（例 `[project, function]`）などの非階層軸は、責任境界の「表示軸」を切り替える別操作として扱う。
- ただし現状の `docs/reference-implementation.md` は「Activity zoom = choose decomposition scope」「Boundary zoom = choose responsibility boundary」を共存する2軸として記述しており（`docs/reference-implementation.md` の `Activity decomposition zoom` 節）、README の定義と用語が衝突している。本イシューはこの不整合の解消も含む。

## 問題

現在の reference implementation では、ズームの主体が責任境界ではなく Activity 分解階層になっている。

- `AppState.focusActivityId` を主可視化のスコープ状態として保持し（`src/main.ts:33-34,51-56`）、Inspector の「Zoom into this Activity」「Zoom out」やパンくずが `focusActivityId` を変更する（`src/main.ts:185-188,494-504,520-526`）。
- 射影は `leafIdsUnder(state.focusActivityId)` で切り出した leaf 集合に対して行われる（`src/main.ts:209,239,414-423`）。
- 責任境界は `#boundary-select` セレクトボックスで切り替えるだけの独立操作になっている（`src/main.ts:83-88,506-512`）。
- タブ名も `Activity zoom` であり（`src/main.ts:81`）、Activity tree と boundary projection が並列の主表示として扱われている（`src/main.ts:232-279`）。

その結果、利用者にとっての「ズーム」が Activity 分解階層による表示範囲の変更になっており、責任境界による詳細度制御という中心コンセプトを表現できていない。

## 目標

ズームイン／ズームアウトを、同じ Activity Graph と同じ表示対象プロセスのスコープに対して、責任境界レベルを階層順に一段階上下させる操作として実装する。

- ズームアウト（上位レベル）では、同一責任境界に属する連続 Activity を合成する。
- ズームイン（下位レベル）では、合成されていた Activity を下位責任境界ごとに分割する。
- スコープ（射影対象の leaf 集合）はズームによって変化しない。

## 対象外

- Activity の `children` による分解階層そのものの削除（モデリング・インスペクション用途として残す）。
- 非階層軸である `function`、`role`、`system`、複合 boundary を階層型ズームとして扱うこと。
- DSL パーサ、永続化層、レイアウトエンジン依存の追加（reference implementation のスコープ外、`docs/reference-implementation.md` 参照）。

## 提案する方針

1. 階層型責任境界の順序を、明示的な順序付き定数として定義する（例: `["company", "department", "section", "team", "person"]`）。これを階層ズームの唯一の真実とする。
2. ズーム状態を `focusActivityId` ではなく、現在の責任境界レベル（上記順序のインデックス、または boundary キー）として保持する。`AppState` を見直し、主可視化のスコープは「表示対象プロセス全体の leaf 集合」に固定する。
3. ズームイン／ズームアウトは、`boundary` を階層順に一段階変更し、固定スコープに対して `projectByResponsibilityBoundary`（`src/normalize.ts` 経由、`src/index.ts` 公開）を再実行する。
4. 階層の両端ではズーム方向をクランプする（`company` でズームアウト不可、`person` でズームイン不可）。該当ボタンは無効化する。
5. 現在の Boundary 選択 UI（`#boundary-select`）のうち、階層型責任境界はズーム操作（インアウト）へ統合する。`function`、`role`、`system`、複合 boundary は「表示軸の切り替え」として、ズームとは別の UI 要素に分離する。
6. `Activity zoom` というタブ名・操作 semantics を変更し、`children` による移動を「ズーム」と呼ばない名称（例: decomposition / drill-down）へ改める（`src/main.ts:81`、Inspector のボタン文言 `src/main.ts:185-188`）。
7. 選択中 Activity（`selectedActivityId`）は、ズーム後も対応する atomic または composite node へ追従させる。追従規則は「選択中 leaf を含む projected node を選択状態にする」を基本とする（atomic ならその leaf、composite なら合成先 node）。
8. `docs/reference-implementation.md` の `Activity decomposition zoom` 節を、用語衝突が解消されるよう更新する（「ズーム＝責任境界レベル」「分解＝drill-down」の区別を明記）。

## 受け入れ条件

- [ ] Given サンプルモデル表示時、when ズームイン／ズームアウト操作、then 責任境界レベルが階層順に一段階だけ変わる。
- [ ] Given 任意のレベル、when ズーム、then 元の Activity Graph および表示対象プロセスのスコープ（leaf 集合）は変わらない。
- [ ] Given 各責任境界レベルの表示、then Responsibility Boundary Normal Form が維持される（`isResponsibilityBoundaryNormalForm` が true）。
- [ ] Given 上位レベル表示、then 同一責任境界の連続 Activity が合成される。
- [ ] Given 下位レベル表示、then 上位で合成されていた Activity がより詳細な責任境界単位へ展開される。
- [ ] Given `company` でズームアウト、または `person` でズームイン、then 操作は無効化されレベルは変わらない。
- [ ] サンプルモデルで `company` / `department` / `section` / `person` の表示差を確認できる。
- [ ] Activity 分解階層（`children`）への移動は、責任境界ズームとは別の操作名・別の UI として明確に分離される。
- [ ] 選択中 Activity がズーム後も対応する projected node に追従する。

## テスト計画

- 単体テスト（`src/__tests__/` に追加）:
  - 階層順序定数に対し、固定 leaf スコープへ各レベルで `projectByResponsibilityBoundary` を適用し、normal form が維持されることを検証する。
  - サンプルモデルの leaf 集合に対する各レベルの projected boundary 列が下記の期待列に一致することを検証する。
  - ズームイン／アウトのレベル遷移関数が、両端でクランプされることを検証する。
- 期待表示差（サンプルモデル、flow 順）:
  - `company`: `Example Construction -> Partner Company -> Example Construction`
  - `department`: `Sales Department -> Construction Department -> Administration Department`
  - `section`: `Sales Section -> Estimation Section -> Sales Section -> Construction Section -> Procurement Section -> Construction Section -> Accounting Section`
  - `person`: 各 leaf Activity が担当者単位で表示される（連続同一担当がなければ leaf 数と一致）
- 手動確認:
  - ズーム前後で Activity Graph と表示対象プロセスのスコープが変わらないことを UI で確認する。
  - Activity 分解階層への移動が、責任境界ズームとは別の操作名・別の UI として扱われることを確認する。
  - 選択中 Activity の追従を確認する。
- 実行コマンド: `npm test`、`npm run typecheck`（`package.json` のスクリプトに準拠）。

## リスク

- 既存の `focusActivityId` を前提にした選択状態・表示範囲制御（`src/main.ts` の各 render / bindEvents）が、責任境界ズームへの変更で破綻する可能性がある。
- 階層型責任境界と非階層 boundary 軸の UI が混在すると、操作 semantics が再び曖昧になる可能性がある。`docs/reference-implementation.md` の用語更新と同期しないと不整合が残る。
- ズーム後の選択中 Activity 追従では、atomic node と composite node の対応規則を明確にする必要がある。
- サンプルモデルでは中間 composite Activity に `section` / `team` / `person` 属性が無く、射影は leaf 属性に依存する（`src/sample.ts`）。leaf に当該キーが欠ける場合は `<unassigned>` 扱いになる（`src/boundary.ts:31-32`）ため、`team` レベルなど一部で意図しない合成が起きないか確認する。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Align reference implementation zoom semantics with responsibility boundary levels instead of Activity decomposition scope.

## 注記

- 非階層軸（`function` / `role` / `system` / `[project, function]`）の「表示軸切り替え」UI の具体的な配置・名称は実装時に決めてよい。最小実装は既存セレクトを階層ズームから分離した独立コントロールとして残す方針とする。
- `docs/semantic-core.md` や `docs/theory.md` にズーム用語の規範記述があれば、`docs/reference-implementation.md` と同時に整合させること。
- GitHub Issue labels: none
- GitHub Issue createdAt: 2026-06-24T03:38:35Z
- GitHub Issue updatedAt: 2026-06-24T15:27:52Z
- クローズ時コメント: `Captured as local issue. issues/open/20260625-fix-boundary-zoom.md`
- 2026-07-03: Started implementation from the polished backlog.
- 2026-07-03: Implemented and verified with formatter/check/typecheck/test/build workflow.
