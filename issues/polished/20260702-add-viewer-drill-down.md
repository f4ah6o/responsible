# Viewer に Activity 分解の drill-down / drill-out を実装する

Status: polished
Model: claude-fable-5
Created: 2026-07-02
Updated: 2026-07-02
Branch: feat/20260702-add-viewer-drill-down

## 概要

reference viewer に、Activity 分解階層（`children`）に沿った drill-down / drill-out 操作を追加し、表示スコープ（displayed process の leaf 集合）を親 Activity から子 Activity 配下へ切り替えられるようにする。boundary zoom（責任境界レベル）とは独立した操作として実装する。

## 背景

- `docs/reference-implementation.md` は viewer の 3 操作を `boundary zoom` / `viewport pan/zoom` / `drill-down` として定義し、drill-down を「Activity 分解スコープ（children）の選択」とした上で「v0 viewer では未実装」と明記している。README も「The v0 viewer does not implement interactive drill-down」と記載している（`README.md:26`）。
- 射影は `ProcessView = normalize(project(scope.leaves, boundaryLevel))` であり、drill-down はこの `scope` を変更する操作、boundary zoom は `boundaryLevel` を変更する操作として概念上分離済みである。
- 実装上の footing は既にある。
  - `src/viewer/ProcessViewer.tsx` は `leafIdsUnder(model, rootId)` で leaf 集合を導出し、`scopedProcessModel` でスコープ限定の `ProcessModel` を作って射影している（`ProcessViewer.tsx:32-54`, `78-87`）。現在 `rootId` はサンプルの `rootActivityId` に固定されている。
  - core には `leafActivityIds(model, scopeId?)` があり、任意の Activity をスコープとした leaf 導出ができる（`src/semantic.ts:30`）。
- 現行の 3 サンプル（`src/sample.ts`）は、いずれもルート Activity（例: `software_development`）だけが `children` を持ち、children はすべて leaf である。中間階層（children を持つ中間 Activity）は存在しない。
- 射影は常にスコープ配下の leaf 集合に対して行われる（`ProcessView = normalize(project(scope.leaves, boundaryLevel))`）。したがって、表示される射影ノードの元 Activity は定義上 leaf であり `children` を持たない。「表示中のノードをクリックして drill-down する」という入口は、この射影方式では成立しない。入口はスコープ（分解階層）を選択する専用コントロールとして設計する必要がある。
- `docs/reference-implementation.md` は「children は Activity Inspector に read-only 表示」と記載しているが、現行 viewer（full-viewport canvas への簡素化後）には Inspector パネルが存在しない。文書と実装に既に乖離がある。

## 問題

- 親 Activity が `children` を持っていても、viewer 上でその内部分解を閲覧する手段がない。分解階層はモデルの中心概念（README「Activity は無限に入れ子にできる」）だが、viewer では不可視である。
- どのノードが分解可能（children 持ち）かが表示上区別できない。

## 目標

- 利用者が viewer 上で、`children` を持つ Activity へ drill-down して内部の Process View を閲覧し、drill-out で元のスコープへ戻れる。
- drill-down 中も boundary zoom と viewport pan / zoom が独立して機能し、`zoom ≠ drill-down` の分離が保たれる。

## 対象外

- 非線形フロー（分岐・合流）への対応。drill-down 先スコープも v0 の linear-only 検査の対象のままとする（設計は `issues/open/20260702-design-nonlinear-projection.md`）。
- Activity Inspector パネルの復活・再設計（children 一覧の read-only 表示 UI はスコープ選択コントロールに必要な最小限に留める）。
- leaf 集合または flow を変更するサンプル改変。中間階層の導入は既存 leaf と flow を保ったままのグルーピングに限定する（下記方針 2）。

## 提案する方針

1. `src/viewer/ProcessViewer.tsx` にスコープ状態を追加する。`rootActivityId` を起点とするスコープパス（例: `scopePath: Id[]`、先頭はルート）を持ち、射影は `scopedProcessModel(model, leafIdsUnder(model, currentScopeId))` を用いる。既存の射影経路は変えず、`rootId` 固定を `currentScopeId`（`scopePath` 末尾）に置き換える。
2. 検証可能なデータを用意する。少なくとも 1 つのサンプル（例: `software_development`）に中間階層を導入する。既存 leaf の連続区間（flow 上で連続する leaf 群、例: `implementation` / `self_review` / `code_review` / `fix`）を子に持つ中間 Activity を追加し、ルートの `children` をその中間 Activity で置き換える。leaf 集合と flow は変更しないため、ルートスコープの射影結果（既存テストの期待値を含む）は変わらない。
3. drill-down の入口をスコープ選択コントロールとして実装する。射影ノードの元 Activity は定義上 leaf であるため、ノード操作を入口にしない。ツールバーに現在のスコープパス（breadcrumb）と、現在スコープ直下で `children` を持つ子 Activity の一覧を表示し、選択で drill-down する。breadcrumb の祖先選択で drill-out する。
4. プロセス切替時はスコープをルートへリセットする（既存の `handleProcessChange` と同様の初期化）。
5. drill-down 先スコープの leaf 集合が linear-only 検査に違反する場合（flow 上で非連続な children を持つ場合、`src/normalize.ts:159-185` が throw する）、現在 `useMemo` 内の射影は捕捉されずクラッシュする。射影を try/catch で包み、エラーメッセージを UI 上に表示して直前の有効なスコープへ戻れるようにする。
6. `docs/reference-implementation.md` の「v0 viewer では drill-down 未実装」「Inspector に read-only 表示」の記述、および `README.md:26`「The v0 viewer does not implement interactive drill-down」を実装後の状態へ更新する。乖離している Inspector の記述はこの機会に現状へ合わせる。
7. スコープ切替の射影結果について `node:test` テストを追加する（例: 中間 Activity へ drill-down した際の期待 Process View、非連続 children スコープの射影が throw すること）。

## 受け入れ条件

- [ ] Given 中間階層を持つサンプル、when viewer を開く、then ツールバーに現在スコープ（ルート）と drill-down 可能な子 Activity の一覧が表示される。
- [ ] Given ルートスコープ、when 中間 Activity へ drill-down する、then 表示スコープがその Activity 配下の leaf 集合に切り替わり、Process View が再射影される。
- [ ] Given drill-down 中、when breadcrumb で祖先スコープを選択する、then そのスコープへ drill-out して再射影される。
- [ ] Given drill-down 中、when boundary zoom を操作する、then スコープを維持したまま責任境界レベルだけが変わる。
- [ ] Given drill-down 中、when プロセスを切り替える、then スコープがルートへリセットされる。
- [ ] Given linear-only 検査に違反するスコープ、when drill-down する、then エラーが UI 上に表示され、アプリケーションはクラッシュせず、有効なスコープへ戻れる。
- [ ] サンプル再構成後もルートスコープの射影結果が変わらず、既存テストが修正なしで成功する。
- [ ] `docs/reference-implementation.md` と `README.md` の drill-down / Inspector 記述が実装後の状態と一致する。
- [ ] スコープ別射影の期待結果と linear-only 違反時の throw を検証する `node:test` テストが追加され、`pnpm test` が成功する。

## テスト計画

- `pnpm test` で既存 45 件（修正なし）と追加テストがすべて成功することを確認する。
- `pnpm run check` と `pnpm run typecheck` が成功することを確認する。
- `pnpm run dev` で、中間階層を持つサンプルについて drill-down → boundary zoom 操作 → drill-out の一連の手動確認を行う。
- 中間階層を持たないサンプルでは drill-down 対象が表示されない（またはコントロールが無効化される）ことを手動確認する。
- プロセス切替でスコープがリセットされることを手動確認する。

## リスク

- サンプルへの中間階層導入は `model.activities` にエントリを追加する。leaf 集合と flow を変えない限り射影結果は不変だが、`children` の構成を flow 上の連続区間に限定しないと drill-down 先が linear-only 検査で拒否される。中間 Activity の children は flow 上の連続区間から選ぶ。
- `leafIdsUnder`（viewer 側）と `leafActivityIds`（core 側）の重複実装があり、スコープ導出をどちらへ寄せるかで core の公開 API に影響しうる。core を変更する場合も依存ゼロ制約を維持する。
- 射影エラーの UI 表示は viewer 初のエラー状態導入であり、表示方式（インライン表示かトースト相当か）は実装時の裁量とする。エラー時に操作不能へ陥らないことだけを要件とする。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Add interactive drill-down / drill-out to the reference viewer: the displayed-process scope can move along the Activity decomposition hierarchy (`children`), independently of boundary zoom and viewport pan / zoom. (`issues/open/20260702-add-viewer-drill-down.md`)

## 注記

- `docs/reference-implementation.md` の「Zoom and decomposition」節が定義する 3 操作の分離（boundary zoom / viewport pan/zoom / drill-down）を実装の判断基準とする。
- 現行 viewer に Inspector が存在しない点は文書側の乖離であり、本イシューの文書更新で解消する。
- 将来、射影ノードから所属サブスコープへ移動するショートカット（例: ノードのダブルクリックで、その leaf を含む直下のサブスコープへ drill-down）を追加できるが、本イシューではスコープ選択コントロールのみを必須とする。
- 2026-07-02: polish-issue: 品質基準を満たしたため polished へ遷移
