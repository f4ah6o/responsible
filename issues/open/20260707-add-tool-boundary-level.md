# 階層境界ズームに `tool`(ツール/アプリ)レベルを追加する(Stage 1)

Status: open
Model: Claude
Created: 2026-07-07
Updated: 2026-07-07

## 概要

`docs/workflow-discovery.md` の Stage 1 として、viewer の階層境界順序に最詳細レベル `tool` を追加し、レーンに利用ツール/アプリまで書けるようにする。`person` へズームアウトすると RBNF で畳み込まれることをテストで表明する。

## 背景

- `responsibility` の軸は元々任意(`src/model.ts` の `Responsibility = Readonly<Record<BoundaryKey, BoundaryValue>>`)であり、モデル文書はすでに `tool: "Excel"` のような軸を書ける。意味論コアの変更は不要。
- 階層境界ズームは viewer 規約 `HIERARCHICAL_BOUNDARY_ORDER`(`src/hierarchy.ts`)= `company < department < section < team < person` で定義され、`buildLaneHierarchy`(`src/viewer/buildLaneHierarchy.ts`)はこの順序を `slice(0, zoomLevel + 1)` して入れ子レーンを構築する。順序に追加すればレーン構築・`clampZoomLevel`・`ZOOM_LEVEL_COUNT` は自動追従する。
- 規範設計は `docs/workflow-discovery.md`(日英ペア)の「`tool` 境界レベル」節。

## 問題

- 実務レベル(どのツール/アプリで作業するか)をレーンとして表示できず、Stage 2 の発見コンバータが出力する `tool` 軸を viewer で観察する手段がない。

## 目標

- 境界ズームを `tool` まで詳しくでき、`tool` 軸を持つモデルでツール/アプリ別の入れ子レーンが表示される。`person` に粗くすると同一担当者の連続 Activity が畳み込まれる。

## 対象外

- 操作ログ形式・発見コンバータ(Stage 2)、Windows 記録スクリプト(Stage 3)。
- 意味論コア(`docs/semantic-core.md`)の変更。`tool` は viewer の階層順序への追加であり、新しいプリミティブではない。
- `tool` 軸専用の描画(アイコン等)。既存レーン描画のままとする。

## 提案する方針

1. `src/hierarchy.ts` の `HIERARCHICAL_BOUNDARY_ORDER` 末尾に `"tool"` を追加する。`HierarchicalBoundaryKey` / `ZOOM_LEVEL_COUNT` / `clampZoomLevel` は導出値なので変更不要。
2. `src/viewer/BoundaryZoomControl.tsx` の `BOUNDARY_LABELS` に `tool: "ツール/アプリ"` を追加する。
3. `src/sample.ts` のソフトウェア開発サンプル(`person` 軸を持つ Activity 群)に `tool` 軸(例: `"GitHub"`, `"IDE"`, `"Slack"` など現実的な値)を追加し、views に `{ id: "tool_view", layout: "lane", boundary: "tool", normalForm: "responsibilityBoundary" }` を追加する。連続する同一 `(person, tool)` の Activity を最低 1 組含め、`tool` ズームで分かれ `person` ズームで畳まれることを目視確認できるようにする。
4. `examples/order-fulfillment.json` の担当者付き Activity にも `tool` 軸を追加し、README の説明と齟齬がないようにする。
5. ドキュメント更新: `README.md` / `README.ja.md` と docs 内の `company < department < section < team < person` 相当の記載を `… < person < tool` に更新する。`grep -rn "team < person\|team, person\|company … person\|company \\.\\.\\. person" README*.md docs/` 等で全箇所を特定してから書き換えること(README の Features 節・boundary zoom 説明、`docs/semantic-core.md` の例示などに複数箇所ある)。`docs/workflow-discovery.md`(日英)の Staged plan 表の Stage 1 行はそのまま。
6. `<unassigned>` の挙動は既存のまま: `tool` 軸を持たないモデルは `tool` ズームで `<unassigned>` レーンに落ちる(`person` 未指定と同じ)。コード変更は不要だが、テストで表明する。

## 受け入れ条件

- [ ] `HIERARCHICAL_BOUNDARY_ORDER` が 6 レベルになり、viewer の境界ズームで「ツール/アプリ」(レベル 6/6)まで詳しくできる。
- [ ] `tool` 軸を持つサンプルで、`tool` ズームでは `person` レーンの中にツール別レーンが入れ子表示され、`person` ズームでは同一担当者の連続 Activity が 1 ノードに畳み込まれる。
- [ ] `tool` 軸を持たない既存モデル(他のバンドルサンプル、`examples/application-approval.v1.json`)が従来どおり読み込め、`tool` ズームでは `<unassigned>` レーンに解決される。
- [ ] URL ハッシュの `z=5`(tool レベル)が共有・復元でき、範囲外の値は従来どおりクランプされる。
- [ ] `pnpm run check && pnpm run typecheck && pnpm test && pnpm run build` が通る。

## テスト計画

- `src/__tests__/boundary-zoom.test.ts`: レベル数が 6 であること、`person` → `tool` へのズームイン、`canZoomIn`(person で true / tool で false)、`clampZoomLevel(6)` が tool に丸められること。
- `src/__tests__/hierarchical-lanes.test.ts`: `tool` 軸を持つモデルの `buildLaneHierarchy(view, activities, 5)` が person レーンの子として tool レーンを持つこと。`tool` 軸のない Activity が `<unassigned>` tool レーンに入ること。
- `src/__tests__/projection.test.ts` または既存の適切なスイート: 同一 `(…, person)` で `tool` だけ異なる連続 Activity が、境界 `person` への射影(RBNF)で 1 つの composite に畳まれ、境界 `tool` では分かれること。

## リスク

- レベル追加により既存の URL 共有リンク(`z=` の意味)は変わらない(既存レベルのインデックスは不変、末尾追加のみ)が、`z` の最大値が変わるためクランプ挙動のテストを更新する必要がある。
- サンプルへの `tool` 軸追加で `src/__tests__/` 内のサンプル依存テスト(レーン数や boundary 文字列の期待値)が壊れる可能性がある。期待値の更新で対応する。

## 変更履歴

`CHANGES.md` impact: yes

項目案:

- Add `tool` as the finest hierarchical boundary level so lanes can show the tool/application used, folding into person-level views via RBNF. (`issues/open/20260707-add-tool-boundary-level.md`)

## 注記

- 規範文書は `docs/workflow-discovery.md`(日英ペア)。
