# viewer に Effect を描画し v1 サンプルを追加する（Stage 3）

Status: done
Model: Claude
Created: 2026-07-06
Updated: 2026-07-06
Branch: claude/responsible-v1-impl-xkq73q

## 概要

`docs/responsible-v1.md` の Stage 3 として、リファレンス viewer に宣言された effect の描画を追加し、v1 サンプルプロセスと example JSON を整備し、README / docs のスキーマ記述を v1 対応に更新する。

## 背景

- Stage 2（`issues/open/20260706-project-effects-across-boundaries.md`）完了後、選択中の境界ビューにおける観測可能な effect 集合が `projectEffects` で計算できる。
- viewer は `ProcessView` を消費する単一画面構成（`src/viewer/`）で、フローエッジ・レーン・ドリルダウン・境界ズームを既に持つ。

## 問題

- effect はモデルに書けても viewer に現れず、「境界を越えて観測可能になる」という v1 の中心概念が視覚化されない。
- バンドルされたサンプル・example に v1 文書がなく、ユーザーが v1 の書き方を参照できない。

## 目標

- viewer 上で、境界ズームに応じて effect が現れたり隠れたりする様子が確認できる状態。

## 対象外

- effect の編集 UI。viewer は引き続き読み取り専用。
- 実行・シミュレーション。

## 提案する方針

1. Activity ノードに effect バッジ（payload kind + schema）を表示し、directed effect はフローエッジと視覚的に区別された破線エッジとして target 境界レーンへ描画する（`projectionToFlow.ts` / `ActivityNode.tsx` / `FlowCanvas.tsx`）。
2. broadcast / observable の表現（ノードバッジのみ等）を決め、凡例を追加する。
3. `ModelLoader` が v1 文書を受け入れることを確認し、v0 読み込み時の扱い（そのまま / `migrateProcessModelToV1` の提案）を決める。
4. 契約と作用を含む v1 サンプルプロセス（`docs/activity-effects.md` の申請承認例ベース）を `src/sample.ts` に追加し、`examples/` に v1 JSON を追加する。v0 サンプルを 1 つ残して二重バージョン対応を固定する。
5. `README.md` / `README.ja.md` のスキーマ節・機能一覧を v1 対応に更新する。

## 受け入れ条件

- [x] 境界ズームを動かすと、同一境界に collapse された directed effect が隠れ、境界を跨ぐビューで現れる。
- [x] v1 example JSON が `ModelLoader` から読み込め、effect が描画される。
- [x] v0 example / サンプルが従来どおり動作する。
- [x] `pnpm run check && pnpm run typecheck && pnpm test && pnpm run build` が通る。

## テスト計画

- `projectionToFlow` 相当の変換に `node:test` を追加し、effect → エッジ/バッジ変換を表明する。
- ブラウザで 4 サンプル + v1 サンプルを境界ズーム全段で目視確認する。

## リスク

- レーン横断の破線エッジは既存のエッジルーティングと干渉しうる。`docs/nonlinear-projection.md` の残課題（richer viewer edge routing）と合わせて検討する。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Render declared v1 effects in the viewer (node badges + dashed cross-lane edges), add a v1 sample process and example JSON, and update README schema docs. (`issues/open/20260706-render-effects-in-viewer.md`)

## 注記

- 規範: `docs/responsible-v1.md` の「Viewer（Stage 3）」。着手は Stage 2 の受け入れ条件成立後。
- 2026-07-06: 実装完了。effect はノード上のバッジ + directed の破線エッジ（target 境界レーンへ不可視ハンドルでアンカー）として描画。target レーンがビュー外の場合はバッジのみに退化。`INV-3` 違反はフロー描画を止めない notice パネルで表示。effect の解決はフルモデル + `scopeId` で行い、ドリルダウンでの誤発火を回避。レイアウトのカード高さ見積もりに effect 行を加算。凡例をツールバーに追加。v1 サンプル `申請承認（契約と作用）` と `examples/application-approval.v1.json` を追加し、`node:test`（`effect-flow.test.ts`）と Playwright での目視（company / department / team ズーム）で検証した。broadcast / observable のノード表現はバッジで確定し、当初案の凡例つき別表現は不要と判断。
