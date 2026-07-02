# リファレンス実装を業務プロセス可視化専用ビューアとして作り直す

Status: done
Model: GPT-5
Created: 2026-06-25
Updated: 2026-07-03
Branch: feat/8-process-viewer
Source:

- https://github.com/f4ah6o/responsible/issues/8

## 概要

リファレンス実装の中心を、Activity と Lane（責任境界）を中心にした業務プロセス可視化専用の node-based viewer に据え直す。Activity を node、Lane を責任境界・担当領域・処理領域、Lane をまたぐ接続を責任境界越え・引き渡しとして 1 画面で同時に追えるビューアにする。視覚的な pan / zoom（ビューポート操作）に対応し、建設業に依存しない 3 種類の静的サンプルプロセスを切り替えて閲覧できるようにする。

この作り直しに伴い、`docs/reference-implementation.md` の「リファレンス実装」定義と Dependency policy を改定し、リファレンス実装内での可視化ライブラリ依存（React Flow 相当）を許可する。

## 背景

- 目的は、Responsible の概念を説明する汎用 UI ではなく、Activity と Lane を中心にした業務プロセス可視化のリファレンス実装である。
- Vite ベースの現行フロントエンド構成（`vite.config.ts`、`index.html`、`src/main.ts`）は使用してよい。
- データはまず静的サンプルでよく、プロセス定義と viewer 表示ロジックを分離する。

### 確定した設計判断（GitHub Issue #8 / polish 時の決定）

本イシューはリポジトリの既存規約・既存実装と衝突する論点を含んでいたが、次の通り確定した。

1. **「リファレンス実装」の語義を改定する（Q1）**: 従来 `docs/reference-implementation.md` は「リファレンス実装＝依存ゼロのコア＋依存ゼロ可視化」と定義していた。本イシューでこの定義を改定し、**viewer をリファレンス実装の中心**に据える。`docs/reference-implementation.md` と README の該当記述を更新する。
2. **Dependency policy を改定し可視化依存を許可する（Q2）**: リファレンス実装内で可視化ライブラリ（React Flow 相当）への依存を許可するよう `docs/reference-implementation.md` の Dependency policy を改定する。ただし純粋射影コア（`src/model.ts` / `src/boundary.ts` / `src/hierarchy.ts` / `src/normalize.ts` / `src/semantic.ts` / `src/index.ts`）は plain TypeScript・pure function のまま維持し、viewer が `ProcessView` を消費する構造を保つ（モデルは可視化に依存しない）。
3. **建設業サンプルを置換する（Q3）**: `src/sample.ts` の建設業サンプル（`Example Construction` 等）を 3 種類の中立サンプルへ置換し、これに依存する `src/__tests__/boundary-zoom.test.ts` の期待値（boundary 列・flow 順）を新サンプルへ更新する。
4. **boundary zoom を維持する（Q4・Q5）**: 直前マージ済みの責任境界ズーム semantics（`fix-boundary-zoom`、commit `af1611c`）を維持・包含する。新規に追加する視覚的ビューポート操作は **viewport pan / zoom** と呼び、責任境界レベルの **boundary zoom** とは UI・用語上分離する。README Design principles 11（zoom＝責任境界切替）の予約語との整合を保つ。

### 既存実装の現状

- `src/main.ts`（626 行）は commit `af1611c` 時点で、Activity ノード、責任境界レーン（`Boundary lanes` 画面）、Lane 越え edge、選択 Activity の Inspector、boundary zoom（責任境界レベル切替）、`children` ドリルダウンを実装済み。可視化は `src/graph.ts`（依存ゼロの SVG レイアウト、167 行）が担う。
- 公開コア API は `src/index.ts` 経由で `projectByResponsibilityBoundary`（`src/normalize.ts`）、`ProcessView` / `ProjectedActivity`（`src/model.ts`）、`HIERARCHICAL_BOUNDARY_ORDER` ほか（`src/hierarchy.ts`）、semantic 語彙（`src/semantic.ts`）を提供する。
- v0 は linear flow のみ対応。`src/normalize.ts` は branching / merging / cycle / multiple-start / disconnected を `throw` で拒否する（`docs/reference-implementation.md` v0 limitation）。

## 問題

現在のリファレンス実装は、機能が複数画面（`Graph nodes` / `Activity decomposition` / `Boundary lanes`）に分かれ、業務プロセス（Activity・Lane・接続・境界越え）を 1 画面で同時に追う「業務プロセス可視化専用 viewer」としての純度が低い。また唯一のサンプルが建設業（`Example Construction`）に固定され、構造を説明しやすい中立な題材になっていない。さらに、ビューポートの視覚的な pan / zoom（全体俯瞰と詳細確認の切替）が存在しない。

求める最終形は、Activity を node、Lane を責任境界・担当領域・処理領域、Lane をまたぐ接続を引き渡し／責任境界越えとして 1 画面で表示し、プロセス切替・選択 Activity の詳細・視覚的な viewport pan / zoom に対応する viewer である。

## 目標

1 画面で完結する node-based viewer を実装し、次を同時に満たす。

- Activity を node として表示し、Activity 間の接続でプロセスの流れを表す。
- Lane（責任境界・担当領域・処理領域）を表示し、Lane をまたぐ接続で責任境界越え・引き渡しを表す。
- 選択中 Activity の詳細を確認できる。
- 視覚的な viewport pan / zoom で全体俯瞰と詳細確認を切り替えられる（責任境界レベルの boundary zoom とは別操作）。
- 既存の boundary zoom（責任境界レベル切替）を維持する。
- 建設業に依存しない、構造を説明しやすい 3 種類の静的サンプルプロセスを切り替えて閲覧できる。
- プロセス定義と viewer 表示ロジックを分離する。

## 対象外

- 建設業務向けアプリを作ること。
- 汎用 BPMN エディタを作ること。
- 完全な編集機能を作ること。
- Responsible の全概念を UI に詰め込むこと。
- 純粋射影コアの公開 API（`projectByResponsibilityBoundary` / `ProcessView` / `ProjectedActivity` / `boundaryOf` / `HIERARCHICAL_BOUNDARY_ORDER` / semantic 語彙）を破壊的に変更すること。viewer はモデル（`ProcessView`）の下流に留める。
- 責任境界ズーム semantics（`fix-boundary-zoom`、`af1611c`）を巻き戻すこと。
- v0 の linear-only 制約を緩めること（分岐・並行・例外パスの可視化は v0 範囲外）。

## 提案する方針

1. **React Flow（`@xyflow/react`）+ React で viewer を再構成する**: node-based viewer ライブラリとして **React Flow（`@xyflow/react`）** を採用し、ランタイム依存に `react` / `react-dom` / `@xyflow/react` を追加する（Dependency policy 改定によりリファレンス実装内での依存を許可）。現行のバニラ TS（`src/main.ts` の `innerHTML`/`addEventListener`）を React アプリへ置き換える。
   - **対応付け**: Activity → React Flow の custom node、責任境界値 → Lane（React Flow の parent/group node、水平レーンを上下に積む）、cross-boundary transition → Lane をまたぐ edge。
   - **viewport pan/zoom・選択**: React Flow 標準の pan/zoom、`Controls`、`MiniMap`、`onNodeClick` 選択イベントを利用する。
   - **選定理由**: イシューが明示する「React Flow 相当」に最も忠実で、node/edge/viewport pan-zoom/custom node/選択が標準提供される（MIT、活発に保守）。代替として検討したバニラの swimlane 対応ライブラリ（maxGraph など）は React 非依存だが lane/pan-zoom を低レベル API で組む必要があり、本イシューの「React Flow 相当」要件に対し実装コストが高い。
2. **純粋射影コアは維持し、viewer はその下流に置く**: viewer は `projectByResponsibilityBoundary` が返す `ProcessView` / `ProjectedActivity` を消費して描画する。Activity → node、責任境界値 → Lane、cross-boundary transition → Lane をまたぐ edge という対応で 1 画面に統合する。コアの純粋射影 `ProcessModel -> ProcessView` は変更しない。
3. **1 画面構成へ純化し、interactive drill-down は v0 で実装しない**: 現在の `Graph nodes` / `Boundary lanes` / `Activity decomposition` を、Activity node・Lane・connection・境界越えを同時表示する単一画面へ統合する。`children` によるナビゲーション（drill-down / drill-out の遷移）は v0 viewer では実装しない。`children` 情報は選択 Activity の Inspector に「子 Activity」一覧として読み取り専用で参照表示するに留める（クリック遷移なし）。これにより「zoom ≠ drill-down」の混同を物理的に排除する。`docs/reference-implementation.md` の drill-down 記述はこの v0 範囲に合わせて更新する。
4. **viewport pan / zoom を追加する**: React Flow 標準の viewport pan / zoom（`Controls` / `MiniMap` 含む）を用いる。これは boundary zoom（責任境界レベル切替）とは別概念として、UI・用語上明確に分離する。boundary zoom は既存の `HIERARCHICAL_BOUNDARY_ORDER` ベースのレベル切替を維持し、専用の `BoundaryZoomControl`（Zoom in / Zoom out ボタン）で操作する。
5. **プロセス定義と表示の分離を維持し、切替は select で行う**: サンプルは `ProcessModel`（`src/model.ts` の型）として定義し、viewer はそれを射影・描画するだけにする。3 サンプルの切替はヘッダーの `<select>`（`ProcessSelect`）で行う。起動時の既定は **ソフトウェア開発サンプル**、既定の boundary level は **`department`**（`HIERARCHICAL_BOUNDARY_ORDER` の index 1、既存 `DEFAULT_ZOOM_LEVEL` を踏襲）。
6. **3 種類の中立サンプルへ置換する**（建設業に依存しない、構造を説明しやすい題材）:
   - ソフトウェア開発プロセス: Issue triage、Design、Implementation、Review、Test、Release。
   - ドキュメント作成・レビュー・公開プロセス: Draft、Review、Revise、Approve、Publish、Archive。
   - AI agent / tool execution process: User request、Context collection、Planning、Tool execution、Verification、Response。
   - 各サンプルは Lane をまたぐ接続を 1 つ以上含み、責任境界越えを示せること。
   - boundary zoom を維持するため、各サンプルの leaf Activity に `HIERARCHICAL_BOUNDARY_ORDER`（`company < department < section < team < person`）と整合する responsibility 属性を与える。組織レベル割当は下記「### サンプルの組織レベル割当」で確定する。
   - v0 の linear-only 制約に適合する linear flow で定義する（分岐が必要な題材は linear に簡約する）。
7. **既存テストの期待値を新サンプルへ更新する**: `src/__tests__/boundary-zoom.test.ts` の代表サンプルを **ソフトウェア開発プロセス**に置き換え、下記の projected boundary 列（normalize 後）を期待値にする。

### サンプルの組織レベル割当

各 leaf Activity の `responsibility`（`company` / `department` / `section` / `team` / `person`）を次の通り確定する。`boundaryOf`（`src/boundary.ts`）が欠損キーを `<unassigned>` にするため、全 leaf に 5 レベルを与える。各 flow は記載順の linear flow とする。

**1. ソフトウェア開発プロセス**（`company` = `Acme Software`、代表サンプル）

| Activity       | department  | section            | team    | person |
| -------------- | ----------- | ------------------ | ------- | ------ |
| Issue triage   | Product     | Product Management | Triage  | Alice  |
| Design         | Engineering | Architecture       | Design  | Bob    |
| Implementation | Engineering | Application        | Feature | Carol  |
| Review         | Engineering | Application        | Feature | Dan    |
| Test           | Quality     | QA                 | Test    | Erin   |
| Release        | Platform    | Release Eng        | Ops     | Frank  |

projected boundary 列（normalize 後 = 隣接同値を合成）:

- `company`: `["Acme Software"]`
- `department`: `["Product", "Engineering", "Quality", "Platform"]`
- `section`: `["Product Management", "Architecture", "Application", "QA", "Release Eng"]`
- `team`: `["Triage", "Design", "Feature", "Test", "Ops"]`
- `person`: `["Alice", "Bob", "Carol", "Dan", "Erin", "Frank"]`

境界越え: `department` レベルで `Product → Engineering → Quality → Platform` の 3 引き渡し。

**2. ドキュメント作成・レビュー・公開プロセス**（`company` = `Beacon Media`）

| Activity | department | section    | team       | person |
| -------- | ---------- | ---------- | ---------- | ------ |
| Draft    | Authoring  | Writers    | Docs       | Mia    |
| Review   | Authoring  | Editors    | Review     | Noah   |
| Revise   | Authoring  | Writers    | Docs       | Mia    |
| Approve  | Governance | Compliance | Approval   | Olivia |
| Publish  | Platform   | Web        | Publishing | Pavel  |
| Archive  | Platform   | Records    | Archive    | Quinn  |

projected boundary 列:

- `company`: `["Beacon Media"]`
- `department`: `["Authoring", "Governance", "Platform"]`
- `section`: `["Writers", "Editors", "Writers", "Compliance", "Web", "Records"]`
- `team`: `["Docs", "Review", "Docs", "Approval", "Publishing", "Archive"]`
- `person`: `["Mia", "Noah", "Mia", "Olivia", "Pavel", "Quinn"]`

境界越え: `department` レベルで `Authoring → Governance → Platform` の引き渡し。

**3. AI agent / tool execution process**（`company` = `Agent Platform`）

| Activity           | department | section   | team     | person    |
| ------------------ | ---------- | --------- | -------- | --------- |
| User request       | Interface  | Frontend  | Chat     | Gateway   |
| Context collection | Runtime    | Retrieval | Context  | Retriever |
| Planning           | Runtime    | Reasoning | Planner  | Planner   |
| Tool execution     | Runtime    | Execution | Tools    | Executor  |
| Verification       | Runtime    | Reasoning | Verifier | Verifier  |
| Response           | Interface  | Frontend  | Chat     | Gateway   |

projected boundary 列:

- `company`: `["Agent Platform"]`
- `department`: `["Interface", "Runtime", "Interface"]`
- `section`: `["Frontend", "Retrieval", "Reasoning", "Execution", "Reasoning", "Frontend"]`
- `team`: `["Chat", "Context", "Planner", "Tools", "Verifier", "Chat"]`
- `person`: `["Gateway", "Retriever", "Planner", "Executor", "Verifier", "Gateway"]`

境界越え: `department` レベルで `Interface → Runtime → Interface` の往復引き渡し。

### 実装仕様の確定（実装時選択の排除）

実装時に判断を残さないため、次を確定する。

**依存とビルド設定**

- 追加ランタイム依存: `@xyflow/react@^12`、`react@^19`、`react-dom@^19`。追加 devDependency: `@types/react@^19`、`@types/react-dom@^19`。React Flow の CSS は `import "@xyflow/react/dist/style.css";` で読み込む。
- `tsconfig.json` に `"jsx": "react-jsx"` を追加し、`lib` に `DOM` / `DOM.Iterable` を含める。`src/main.ts` を `src/main.tsx` にリネームし、`index.html` の `<div id="app">` にマウントする。
- JSX は esbuild の automatic runtime（`vite-plus`）で変換する。v0 では React Fast Refresh プラグインは導入しない。

**ファイル構成**（純粋射影コアは変更しない）

```text
src/
  main.tsx                      React エントリ。<ProcessViewer/> をマウント。
  viewer/
    ProcessViewer.tsx           状態（選択プロセス・boundary level・選択 node id）を保持し全体を構成。
    FlowCanvas.tsx              <ReactFlow> ラッパ。nodes/edges/lanes・Controls・MiniMap・onNodeClick。
    ActivityNode.tsx            ProjectedActivity 用 custom node。
    BoundaryZoomControl.tsx     HIERARCHICAL_BOUNDARY_ORDER 上の Zoom in / out（boundary zoom）。
    ProcessSelect.tsx           sampleProcesses 切替の <select>。
    Inspector.tsx               選択 Activity の詳細パネル。
    projectionToFlow.ts         ProcessView -> React Flow の { nodes, edges, lanes } へ変換。
  sample.ts                     3 つの ProcessModel と registry。
  styles.css                    プレーン CSS（流用・調整）。
```

- 既存の純粋射影コア（`model.ts` / `boundary.ts` / `hierarchy.ts` / `normalize.ts` / `semantic.ts` / `index.ts`）と `graph.ts` は変更しない。`graph.ts`（依存ゼロ SVG）は公開 API 維持のため残すが、新 viewer は使用せず、レイアウトは `projectionToFlow.ts` が担う。

**レイアウト（`projectionToFlow.ts`）**

- 水平レーン。lane index は projected flow に boundary 値が初めて現れた順。lane（parent/group node）を上から index 順に積む。
- node 座標: `x = flowIndex * 220`、`y = laneIndex * 140`、node 幅 180。composite/atomic とも同一サイズ。これらは決め打ちの初期値とする。
- edge は projected flow（`ProcessView.flows`）をそのまま描画。cross-boundary（異なる lane 間）の edge も同じ描画で lane をまたぐ。

**Inspector の表示項目**

- 選択した projected node について: kind（atomic / composite）、name（composite は合成元の name 一覧）、input、output、status、現在の boundary 値、責任境界の全レベル（`company` / `department` / `section` / `team` / `person`）、composite の場合は合成された `activityIds`、および対応する原 Activity の `children`（あれば、読み取り専用）。
- 選択追従は `af1611c` の規則（選択中 leaf を含む projected node を選択状態にする）を踏襲する。

**`src/sample.ts` の export 形**

```ts
export type SampleProcess = Readonly<{
  id: string;
  title: string;
  rootActivityId: Id;
  model: ProcessModel;
}>;
export const sampleProcesses: readonly SampleProcess[]; // [software, document, aiAgent] の順
export const rootActivityId: Id; // = sampleProcesses[0].rootActivityId（代表＝ソフトウェア開発、テスト後方互換）
export const sampleModel: ProcessModel; // = sampleProcesses[0].model（同上）
```

- `boundary-zoom.test.ts` は `sampleProcesses[0]`（ソフトウェア開発）を対象に更新する。

**各サンプルの完全定義**（root parent + 6 leaf、flows は 6 leaf を記載順に linear 連結。root は composite なので射影対象外、`responsibility` は `company` のみ）

1. ソフトウェア開発（root id `software_development`、company `Acme Software`）。leaf id / input→output:
   - `issue_triage`: `RawIssue` → `TriagedIssue`
   - `design`: `TriagedIssue` → `DesignDoc`
   - `implementation`: `DesignDoc` → `PullRequest`
   - `review`: `PullRequest` → `ReviewedPR`
   - `test`: `ReviewedPR` → `TestedBuild`
   - `release`: `TestedBuild` → `Release`
2. ドキュメント（root id `document_publishing`、company `Beacon Media`）:
   - `draft`: `Outline` → `DraftDoc`
   - `doc_review`: `DraftDoc` → `ReviewedDraft`
   - `revise`: `ReviewedDraft` → `RevisedDoc`
   - `approve`: `RevisedDoc` → `ApprovedDoc`
   - `publish`: `ApprovedDoc` → `PublishedDoc`
   - `archive`: `PublishedDoc` → `ArchiveRecord`
3. AI agent（root id `ai_agent_execution`、company `Agent Platform`）:
   - `user_request`: `UserMessage` → `UserRequest`
   - `context_collection`: `UserRequest` → `Context`
   - `planning`: `Context` → `Plan`
   - `tool_execution`: `Plan` → `ToolResult`
   - `verification`: `ToolResult` → `VerifiedResult`
   - `response`: `VerifiedResult` → `AssistantMessage`

- 各 leaf の `department` / `section` / `team` / `person` は「### サンプルの組織レベル割当」の表に従う（表の行順 = leaf の記載順）。
- 各サンプルの `views` は既存同様に `person` / `section` / `department` / `company` の lane view を持たせる（`team` view も含めてよい）。

8. **ドキュメントを改定する**: `docs/reference-implementation.md` の「リファレンス実装」定義・Dependency policy・Reference implementation scope を、viewer 中心かつ可視化依存許可へ更新する。README の該当記述（`Theoretical position`、`Digital zoom` 周辺）も整合させる。boundary zoom と viewport pan/zoom の用語区別を明記する。

## 受け入れ条件

- [ ] 1 画面の node-based viewer が表示され、Activity node・Lane・connection・境界越えを同時に確認できる。
- [ ] Given 任意のサンプル表示、then Activity が node として表示される。
- [ ] Given 任意のサンプル表示、then Lane（責任境界・担当領域・処理領域）が表示される。
- [ ] Given Lane をまたぐ接続を持つサンプル、then 責任境界を越える作用・引き渡しが視覚的に分かる。
- [ ] Given Activity 間の接続、then 入出力・前後関係が視覚的に追える。
- [ ] Given node を選択、then 選択中 Activity の詳細表示が選択内容に追従する。
- [ ] Given viewer 表示時、when ビューポートの pan / zoom を操作、then 全体俯瞰と詳細確認を切り替えられる。
- [ ] viewport pan / zoom は、責任境界レベルの boundary zoom とは別概念として UI・用語上分離されている。
- [ ] interactive な drill-down（`children` への遷移）は実装されておらず、`children` は Inspector に読み取り専用で表示される。
- [ ] 起動時にソフトウェア開発サンプルが `department` レベルで表示され、`<select>` で 3 サンプルを切り替えられる。
- [ ] `src/graph.ts` を含む純粋射影コアの公開 export は維持されている（新 viewer は `graph.ts` を使用しないが削除しない）。
- [ ] Given boundary zoom 操作、then 責任境界レベルが階層順に一段階変わり、固定スコープに対する射影が再計算される（`af1611c` の semantics を維持）。
- [ ] 3 種類のサンプルプロセスを切り替えられ、それぞれが Activity・Lane・connection を持つ。
- [ ] サンプルに建設会社固有の業務プロセスが含まれていない。
- [ ] viewer はモデル（`ProcessView`）の下流に留まり、純粋射影コアの公開 API を破壊的に変更していない。
- [ ] viewer は `@xyflow/react` を用い、ランタイム依存 `react` / `react-dom` / `@xyflow/react` が `package.json` に追加されている。純粋射影コアは依存ゼロを維持している。
- [ ] `src/__tests__/boundary-zoom.test.ts` がソフトウェア開発サンプルの期待値（上記 projected boundary 列）で緑になる。
- [ ] `docs/reference-implementation.md` と README が、viewer 中心の定義・可視化依存許可・boundary zoom と viewport pan/zoom の用語区別を反映している。
- [ ] `npm run check` が成功する。
- [ ] `npm run build` がフロントエンドのビルドに成功する。

## テスト計画

- 単体テスト:
  - 新サンプル `ProcessModel` が linear flow で `projectByResponsibilityBoundary` を `throw` なく通ることを検証する（v0 linear-only 適合）。
  - ソフトウェア開発サンプルに対し、各責任境界レベルの projected boundary 列が「### サンプルの組織レベル割当」記載の期待列に一致することを `src/__tests__/boundary-zoom.test.ts` で検証する。
  - 3 サンプルすべてについて、`company` レベルが単一ノードへ合成され、`department` レベルで複数ノードへ展開されることを検証する（合成差の回帰防止）。
  - boundary zoom のレベル遷移が両端でクランプされること（既存テスト維持）。
- コマンド:
  - `npm run check`（型・既存検査）が成功する。
  - `npm run typecheck` が成功する。
  - `npm test`（`node:test`）で全テスト（`boundary-zoom` / `projection` / `invariants` / `semantic`）が緑になる。
  - `npm run build` でフロントエンドがビルドできる。
- 手動確認:
  - ブラウザで viewer を開き、1 画面内に Activity node・Lane・connection が同時に表示されることを確認する。
  - 3 種類のサンプルを切り替え、それぞれ Activity・Lane・connection・境界越えが表示されることを確認する。
  - viewport pan / zoom を操作し、全体俯瞰と詳細確認を切り替えられることを確認する。
  - boundary zoom を操作し、責任境界レベルだけが一段階変わり、viewport 操作と独立していることを確認する。
  - node を選択し、詳細表示が選択内容に追従することを確認する。
  - サンプルに建設会社固有の業務プロセスが含まれていないことを確認する。
- 現時点で実行しない確認: 分岐・並行・例外パスを含む非 linear プロセスの可視化は v0 範囲外のため対象外。

## リスク

- Dependency policy 改定と React / React Flow 採用により、リファレンス実装の依存関係とビルドサイズが増え、バニラ TS（`src/main.ts`）から React への移行が必要になる。コアの純粋射影は依存ゼロを維持し、依存は viewer 層に限定して影響を局所化する。
- React 導入で `tsconfig.json`（`jsx` 設定）・Vite（`vite-plus`）の React 対応・`index.html` のマウント点・`fmt`/`check`（`vp`）の JSX 対応の確認が必要になる。ビルド（`npm run build`）と `npm run check` が JSX を含めて通ることを早期に検証する。
- 建設業サンプル置換に伴い `boundary-zoom.test.ts` の期待値を更新しないとテストが破綻する。新サンプルの boundary 列を正確に再計算する必要がある。
- viewer 作り直しで `af1611c` の boundary zoom semantics を壊さないよう、boundary zoom と viewport pan/zoom の責務分離を明確に保つ必要がある。
- responsibility 属性に欠損があると `<unassigned>`（`src/boundary.ts`）扱いが増え boundary zoom の合成差が崩れる。「### サンプルの組織レベル割当」の表で全 leaf に 5 レベルを与え済みのため、実装はこの表の値をそのまま転記し、欠損・改変しないこと。
- viewer 中心へ語義改定するため、`docs/reference-implementation.md` / README の更新と実装が乖離すると規約と実装が再び不整合になる。ドキュメント更新を同じ変更に含める。
- v0 は linear-only。サンプルに分岐を入れると射影が `throw` する。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Changed: rebuild the reference implementation around a single-screen, node-based business process viewer built with React Flow (`@xyflow/react`) consuming `ProcessView` (Activity nodes, responsibility-boundary Lanes, cross-boundary connections, viewport pan / zoom); keep the responsibility-boundary zoom from `af1611c` as a separate control.
- Added: runtime dependencies `react`, `react-dom`, `@xyflow/react` for the reference viewer (pure projection core remains dependency-free).
- Changed: replace the construction-company sample with three construction-independent process samples (software development / document publishing / AI agent execution) and update `boundary-zoom` test expectations accordingly.
- Changed: revise `docs/reference-implementation.md` (reference-implementation definition and Dependency policy) and README to center the reference implementation on the viewer and allow visualization-library dependencies in the reference implementation.

## 注記

- ライブラリ・依存版数・ファイル構成・Lane 方向（水平）・レイアウト座標・drill-down の扱い（v0 非実装）・プロセス切替 UI（select）・既定表示・Inspector 項目・`sample.ts` の export 形・各サンプルの id / 型名 / flow / 組織レベル割当は「### 実装仕様の確定」と「### サンプルの組織レベル割当」で確定済み。実装時の自由裁量は CSS の見た目（色・余白・フォント）と文言に限り、構造・契約は変更しない。
- レイアウト座標（`x=flowIndex*220` 等）と node 幅は初期値であり、表示崩れがあれば見た目調整として変更してよい（受け入れ条件・boundary 列・水平レーン構成は不変）。
- 関連: [[20260625-fix-boundary-zoom]]（責任境界ズーム semantics、commit `af1611c` でマージ済み。本イシューはこれを維持・包含し、viewport pan/zoom と分離）、[[20260624-align-reference-impl-semantic-core]]（semantic core v0 整合、commit `2629e6d`。viewer が消費する `ProcessView` / `Effect` 等の公開 API を提供）。
- 規約参照: `docs/reference-implementation.md`（Dependency policy / Reference implementation scope / Zoom and decomposition / Layering / Design constraint）、README（`Theoretical position`、`Digital zoom`、Design principles 11）。本イシューはこれらを改定する。
- GitHub Issue labels: none
- GitHub Issue createdAt: 2026-06-24T22:15:00Z
- GitHub Issue updatedAt: 2026-06-24T22:15:00Z
- クローズコメント: `Captured as local issue. issues/open/20260625-rebuild-process-viewer.md`
- 2026-07-03: Started implementation from the polished backlog.
- 2026-07-03: Implemented and verified with formatter/check/typecheck/test/build workflow.
