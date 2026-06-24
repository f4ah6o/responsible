# リファレンス実装を業務プロセス可視化専用ビューアとして作り直す

Status: open
Model: claude-opus-4-8
Created: 2026-06-25
Updated: 2026-06-25
Branch: feat/8-process-viewer
Source:

- https://github.com/f4ah6o/responsible/issues/8

## 概要

Activity と Lane（責任境界）を中心にした業務プロセス可視化専用の node-based viewer を実装する。Activity を node、Lane を責任境界・担当領域・処理領域、Lane をまたぐ接続を責任境界越えとして 1 画面で同時に追えるビューアにする。

ただし「作り直す（rebuild）」の対象範囲・依存方針・既存サンプルの扱いは、リポジトリの明示された規約（`docs/reference-implementation.md`）および直前にマージ済みの boundary zoom 作業（commit `af1611c`）と衝突する論点を含む。本イシューは衝突を解消する設計判断が未確定のため `open` を維持する。確定すべき論点は `## 未解決の質問` に記す。

## 背景

- 目的は、Responsible の概念を説明する汎用 UI ではなく、Activity と Lane を中心にした業務プロセス可視化のリファレンス実装である。
- Vite ベースの現行フロントエンド構成（`vite.config.ts`、`index.html`、`src/main.ts`）は使用してよい。
- データはまず静的サンプルでよく、プロセス定義と viewer 表示ロジックを分離する。
- React Flow 相当の表現ができる構成にする。ライブラリ採用は実装時に判断する。

### リポジトリ規約と既存実装の現状（重要）

本イシューの前提は、以下の明示された規約・既存コードと整合させる必要がある。

1. **「リファレンス実装」の定義**: `docs/reference-implementation.md` は、リファレンス実装＝「依存ゼロのコア（`@responsible/core`）＋依存ゼロの SVG 可視化」と定義し、React / Vue / Svelte / graph layout engine / canvas library を core から明示的に除外する。可視化ライブラリを使う renderer は「core の外」の別パッケージ（同ドキュメント Layering 節の `@responsible/react`、`@responsible/svg`、`@responsible/view-json` 等、いずれも placeholder 名）として、モデル安定後に追加する位置づけである。
   - したがってイシューの記述「依存性削減の原則は responsible 本体への制約であり、リファレンス実装では可視化を優先する」は、`docs/reference-implementation.md` の Dependency policy（依存削減はリファレンス実装自体への制約、可視化は core の外）と**直接衝突する**。この衝突の解消が本イシューの前提条件となる（`## 未解決の質問` Q1・Q2）。
2. **既存 viewer は既に多くの要求を満たしている**: `src/main.ts`（626 行）は直前コミット `af1611c` 時点で、Activity ノード、責任境界レーン（`Boundary lanes` 画面）、レーン越え edge、選択 Activity の詳細表示（Inspector）、責任境界レベルのズーム、`children` ドリルダウンを実装済み。可視化は `src/graph.ts`（依存ゼロの SVG レイアウト）が担う。
   - イシューの「問題」記述（現在のリファレンス実装は業務プロセス可視化に純粋特化した viewer ではない）は、現状の `Graph nodes` / `Boundary lanes` 画面が既に Activity node・Lane・cross-boundary edge を表示している事実と部分的に矛盾する。差分は「専用 viewer への純化」であり「ゼロからの新規実装」ではない可能性が高い。
3. **直前作業との関係**: `fix-boundary-zoom`（`issues/polished/20260625-fix-boundary-zoom.md`、commit `af1611c` でマージ済み）が、ズームを責任境界レベル切替として実装し直した。viewer を作り直す場合、この成果を巻き戻さないことが制約になる（`## 未解決の質問` Q4）。
4. **用語衝突**: 本リポジトリで「zoom」は責任境界レベルの切替に予約された語である（README `Digital zoom`、Design principles 11、`docs/reference-implementation.md` Zoom and decomposition 節）。イシューが求める「zoom / pan」は視覚的ビューポート操作であり別概念。両者を同じ「zoom」と呼ぶと semantics が再び曖昧になる（`## 未解決の質問` Q5）。
5. **サンプル置換とテスト**: `src/__tests__/boundary-zoom.test.ts` は建設業サンプル（`src/sample.ts`）の境界値（`Example Construction`、`Sales Department`、`Construction Section` 等）と flow 順を期待値としてハードコードしている。建設業サンプルを削除して別 3 サンプルへ置換すると、このテストが破綻する（`## 未解決の質問` Q3）。

## 問題

現在のリファレンス実装は、複数の画面（`Graph nodes` / `Activity decomposition` / `Boundary lanes`）に機能が分かれており、業務プロセス（Activity・Lane・接続・境界越え）を 1 画面で同時に追う「業務プロセス可視化専用 viewer」としての純度が低い。また、唯一のサンプルが建設業（`Example Construction`）に固定されており、構造を説明しやすい中立な題材になっていない。

求める最終形は、Activity を node、Lane を責任境界・担当領域・処理領域、Lane をまたぐ接続を引き渡し／責任境界越えとして 1 画面で表示し、プロセス切替・選択 Activity の詳細・視覚的な pan / zoom に対応する viewer である。

## 目標

1 画面で完結する node-based viewer を実装し、次を同時に満たす。

- Activity を node として表示し、Activity 間の接続でプロセスの流れを表す。
- Lane（責任境界・担当領域・処理領域）を表示し、Lane をまたぐ接続で責任境界越え・引き渡しを表す。
- 選択中 Activity の詳細を確認できる。
- 視覚的な pan / zoom（ビューポート操作）で全体俯瞰と詳細確認を切り替えられる。
- 建設業に依存しない、構造を説明しやすい 3 種類の静的サンプルプロセスを切り替えて閲覧できる。
- プロセス定義と viewer 表示ロジックを分離する。

## 対象外

- 建設業務向けアプリを作ること。
- 汎用 BPMN エディタを作ること。
- 完全な編集機能を作ること。
- Responsible の全概念を UI に詰め込むこと。
- 依存ゼロのコア（`src/model.ts` / `src/boundary.ts` / `src/hierarchy.ts` / `src/normalize.ts` / `src/index.ts` / `src/semantic.ts`）の公開 API を破壊的に変更すること。viewer はモデルの下流に留める。
- 直前にマージ済みの責任境界ズーム semantics（`fix-boundary-zoom`）を巻き戻すこと。
- `fix-boundary-zoom` のテスト（`src/__tests__/boundary-zoom.test.ts`）が依存する boundary 射影の期待値を破壊すること。

## 提案する方針

以下は、明示された規約（`docs/reference-implementation.md`）と整合する範囲を committed default として記す。規約と衝突する論点（依存ライブラリ採用、サンプル置換）は `## 未解決の質問` で確定してから着手する。

1. **viewer はモデルの下流に置く**: viewer は既存コアの `projectByResponsibilityBoundary`（`src/normalize.ts`、`src/index.ts` 公開）が返す `ProcessView` / `ProjectedActivity` を消費して描画する。Activity → node、責任境界値 → Lane、cross-boundary transition → Lane をまたぐ edge、という対応で 1 画面に統合する。コアの純粋射影 `ProcessModel -> ProcessView` は変更しない。
2. **1 画面構成へ純化する**: 現在の `Graph nodes` / `Boundary lanes` を、Activity node・Lane・connection・境界越えを同時表示する単一画面へ統合する。`Activity decomposition`（drill-down）は補助操作として残すか別 UI に寄せる（README/`docs` の「zoom ≠ drill-down」区別を維持）。
3. **視覚的 pan / zoom を追加する**: ビューポートの pan / zoom を新規に実装する。これは責任境界レベルの「boundary zoom」とは別概念として、UI 上も用語上も明確に分離する（例: viewport pan/zoom と boundary level）。
4. **プロセス定義と表示の分離を維持する**: サンプルは `ProcessModel`（`src/model.ts` の型）として定義し、viewer はそれを射影・描画するだけにする。3 サンプルの切替は表示対象プロセスの切替として実装する。
5. **3 種類の中立サンプルを用意する**（建設業に依存しない、構造を説明しやすい題材）:
   - ソフトウェア開発プロセス: Issue triage、Design、Implementation、Review、Test、Release。
   - ドキュメント作成・レビュー・公開プロセス: Draft、Review、Revise、Approve、Publish、Archive。
   - AI agent / tool execution process: User request、Context collection、Planning、Tool execution、Verification、Response。
   - 各サンプルは Lane をまたぐ接続を 1 つ以上含み、責任境界越えを示せること。
   - v0 の linear-only 制約（`docs/reference-implementation.md` v0 limitation、`src/normalize.ts` が branching / merging / cycle / multiple-start / disconnected を `throw` で拒否）に適合する linear flow で定義する。分岐が必要な題材は v0 範囲で linear に簡約する。
6. **React Flow 相当の表現の実現手段は Q2 の確定後に決める**: 依存ゼロの SVG 実装を拡張する案と、別パッケージ／別ディレクトリに可視化ライブラリ依存の renderer を置く案がある（`docs/reference-implementation.md` Layering の `@responsible/react` 構想に対応）。コア（依存ゼロ）と viewer（依存可否は Q2）を物理的に分離する。

## 受け入れ条件

- [ ] 1 画面の node-based viewer が表示され、Activity node・Lane・connection・境界越えを同時に確認できる。
- [ ] Given 任意のサンプル表示、then Activity が node として表示される。
- [ ] Given 任意のサンプル表示、then Lane（責任境界・担当領域・処理領域）が表示される。
- [ ] Given Lane をまたぐ接続を持つサンプル、then 責任境界を越える作用・引き渡しが視覚的に分かる。
- [ ] Given Activity 間の接続、then 入出力・前後関係が視覚的に追える。
- [ ] Given node を選択、then 選択中 Activity の詳細表示が選択内容に追従する。
- [ ] Given viewer 表示時、when ビューポートの pan / zoom を操作、then 全体俯瞰と詳細確認を切り替えられる（視覚的 pan / zoom）。
- [ ] 視覚的 pan / zoom は、責任境界レベルの boundary zoom とは別概念として UI・用語上分離されている。
- [ ] 3 種類のサンプルプロセスを切り替えられ、それぞれが Activity・Lane・connection を持つ。
- [ ] サンプルに建設会社固有の業務プロセスが含まれていない。
- [ ] viewer はモデル（`ProcessView`）の下流に留まり、依存ゼロのコア公開 API を破壊的に変更していない。
- [ ] `fix-boundary-zoom` の責任境界ズーム semantics と `src/__tests__/boundary-zoom.test.ts` が壊れていない（Q3 の決定に従う）。
- [ ] `npm run check`（型・既存検査）が成功する。
- [ ] `npm run build` がフロントエンドのビルドに成功する。

## テスト計画

- `npm run check` を実行し、既存の検査（型を含む）が成功することを確認する。
- `npm run typecheck` を実行し、TypeScript が通ることを確認する。
- `npm test`（`node:test`）を実行し、既存テスト（`src/__tests__/`、特に `boundary-zoom.test.ts` / `projection.test.ts` / `invariants.test.ts` / `semantic.test.ts`）が緑であることを確認する。
- `npm run build` を実行し、フロントエンドがビルドできることを確認する。
- ブラウザで viewer を開き、1 画面内に Activity node・Lane・connection が同時に表示されることを確認する。
- 3 種類のサンプルプロセスを切り替え、それぞれ Activity・Lane・connection・境界越えが表示されることを確認する。
- 視覚的 pan / zoom を操作し、全体俯瞰と詳細確認を切り替えられることを確認する。
- node を選択し、詳細表示が選択内容に追従することを確認する。
- サンプルに建設会社固有の業務プロセスが含まれていないことを確認する。
- viewer 用に追加するサンプル `ProcessModel` が linear flow で `projectByResponsibilityBoundary` を `throw` なく通ることを単体テストで確認する（v0 linear-only 適合）。
- 現時点で実行しない確認: 分岐・並行・例外パスを含む非 linear プロセスの可視化は v0 範囲外（`docs/reference-implementation.md` 参照）のため対象外。

## リスク

- 「リファレンス実装」の語義衝突（Q1）を解消せずに着手すると、依存ゼロを掲げる `docs/reference-implementation.md` と矛盾する成果物になる。
- 可視化ライブラリ（React Flow 等）を core 内に持ち込むと、Dependency policy（core 依存ゼロ、可視化は外）を破る。別パッケージ／別ディレクトリ分離で回避する必要がある（Q2）。
- 建設業サンプルを削除すると `src/__tests__/boundary-zoom.test.ts` の期待値が破綻する（Q3）。
- 直前マージ済みの責任境界ズーム作業（`af1611c`）を viewer 作り直しで巻き戻す恐れ（Q4）。
- 「zoom」を視覚的 pan/zoom と boundary zoom の二義で使うと、`fix-boundary-zoom` で整理した用語が再び曖昧になる（Q5）。
- v0 は linear-only。サンプルに分岐を入れると射影が `throw` する。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Changed: rebuild the reference visualization layer into a single-screen, node-based business process viewer (Activity nodes, responsibility-boundary Lanes, cross-boundary connections, viewport pan / zoom) consuming `ProcessView`; replace or augment the sample with construction-independent process samples. (最終文言は未解決の質問の確定後に調整する)

## 未解決の質問

実装方針・互換性・安全性を左右するため、確定するまで `open` を維持する。

- **Q1（語義・対象範囲）**: 「リファレンス実装を作り直す」の対象は、(a) 可視化レイヤ（`src/main.ts` / `src/graph.ts` / `src/styles.css` / サンプル）のみで、依存ゼロのコア（`model`/`boundary`/`hierarchy`/`normalize`/`index`/`semantic`）はモデル下流の consumer として維持するのか、(b) `docs/reference-implementation.md` が定義する「リファレンス実装＝依存ゼロのコア＋依存ゼロ可視化」という語義自体を改定するのか。本イシューは default として (a) を想定するが、確定が必要。
- **Q2（依存方針）**: React Flow 等の可視化ライブラリを採用する場合、`docs/reference-implementation.md` の Dependency policy（core 依存ゼロ、可視化は core 外）をどう満たすか。(a) 依存ゼロの SVG 実装拡張で React Flow 相当を実現、(b) 別パッケージ／別ディレクトリ（`@responsible/react` 構想に対応）に可視化依存を隔離、(c) Dependency policy を改定して reference 実装内での依存を許可、のいずれか。
- **Q3（サンプルの扱い）**: 建設業サンプル（`src/sample.ts`）を 3 サンプルへ「置換」するのか「追加」するのか。`src/__tests__/boundary-zoom.test.ts` は建設業サンプルの境界値・flow 順を期待値にしているため、置換するならテストの期待値更新（または建設業サンプルをテスト用 fixture として保持）が必要。
- **Q4（直前作業との関係）**: 本作り直しは `fix-boundary-zoom`（commit `af1611c`、責任境界ズーム semantics）を維持・包含するのか、それとも viewer の再設計に伴い置き換えるのか。維持する場合、boundary zoom と視覚的 pan/zoom の共存方法を確定する。
- **Q5（用語）**: 視覚的ビューポート操作を「zoom」と呼ぶか、boundary zoom と区別する別名（例: viewport pan/zoom）にするか。README Design principles 11 と `docs/reference-implementation.md` の予約語「zoom＝責任境界レベル切替」との整合をどう取るか。

## 注記

- 関連: [[20260625-fix-boundary-zoom]]（責任境界ズーム semantics、commit `af1611c` でマージ済み。本イシューの Q4・Q5 と直接関係）、[[20260624-align-reference-impl-semantic-core]]（semantic core v0 整合、commit `2629e6d`。viewer が消費する `ProcessView` / `Effect` 等の公開 API を提供）。
- 規約参照: `docs/reference-implementation.md`（Dependency policy / Reference implementation scope / Zoom and decomposition / Layering / Design constraint）、README（`Theoretical position`、`Digital zoom`、Design principles 11）。
- GitHub Issue labels: none
- GitHub Issue createdAt: 2026-06-24T22:15:00Z
- GitHub Issue updatedAt: 2026-06-24T22:15:00Z
- クローズコメント: `Captured as local issue. issues/open/20260625-rebuild-process-viewer.md`
