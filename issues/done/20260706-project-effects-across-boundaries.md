# 責任境界を越える Effect の射影を実装する（Stage 2）

Status: done
Model: Claude
Created: 2026-07-06
Updated: 2026-07-06
Branch: claude/responsible-v1-impl-xkq73q

## 概要

`docs/responsible-v1.md` の Stage 2 として、`responsible.v1` 文書に宣言された `EffectDef` から意味論上の `Effect` 値（`src/semantic.ts`）を生成する読み取り専用の射影 `projectEffects(model, boundary, scopeId?)` をコアに実装し、`INV-3` を宣言された effect について表明可能にする。

## 背景

- Stage 1（`issues/done/20260706-implement-v1-schema-core.md`）で `EffectDef` はモデル文書に書けるようになったが、境界式に対する解決（source 境界の導出、directed target の `Responsibility` → `BoundaryId` 解決）は未実装。
- `src/semantic.ts` の `validateDirectedEffect` / `knownBoundaryIds` は生成済み `Effect` の検査に再利用できる。
- 意味論は `effects = project(ensures, boundary)`（`docs/semantic-core.md`）。

## 問題

- モデルに宣言された effect が、選択された境界ビューでどう観測されるかを計算する手段がない。
- directed effect の target が既知の境界かどうか（`INV-3`）が射影時に検査されない。

## 目標

- 任意の境界式・ドリルダウンスコープに対して、宣言された effect の観測可能集合が純関数で計算でき、テストで表明できる状態。

## 対象外

- viewer での描画（Stage 3）。
- `ensures` からの `effects` の自動導出（記号的事実言語が前提、将来課題）。

## 提案する方針

1. `src/semantic.ts`（または新規モジュール）に `projectEffects(model, boundary, scopeId?)` を追加する。スコープ内リーフ Activity の各 `EffectDef` から、`source.boundary = boundaryOf(activity, boundary)`、directed target は宣言 `Responsibility` に `boundaryOf` と同じ規則を適用して解決した `Effect` を生成する。
2. 境界横断規則: 解決後の source と directed target が一致する effect はそのビューでは `tau` として隠す。broadcast / observable は常に保持する。
3. 解決後の target が `knownBoundaryIds` にない directed effect は `INV-3` 違反としてエラー報告する（黙って落とさない）。
4. `ProcessView` に射影済み Activity へ紐づくオプショナルな `effects` を追加するか、独立した戻り値とするかを実装時に決定し、JSON シリアライズ可能性を保つ。
5. `node:test` で、粗い境界（company）で隠れ細かい境界（person）で現れる directed effect、broadcast の保持、未知 target の拒否、射影の読み取り専用性（`INV-1`）を表明する。

## 受け入れ条件

- [x] `projectEffects` が `docs/responsible-v1.md` の境界横断規則どおりに動作し、テストで表明されている。
- [x] 未知の directed target が `INV-3` 違反として報告される。
- [x] 射影は入力モデルを変更しない（`INV-1`）。
- [x] `pnpm run check && pnpm run typecheck && pnpm test && pnpm run build` が通る。

## テスト計画

- `docs/activity-effects.md` の申請承認例を v1 文書化し、`role` 境界と粗い境界での期待 effect 集合を手計算とテストで一致させる。
- 既存 `semantic.test.ts` の `validateDirectedEffect` テストとの整合を確認する。

## リスク

- `ProcessView` の形の変更は viewer（`projectionToFlow.ts`）に波及しうる。オプショナルなフィールドに留め、Stage 3 まで viewer は無変更で通ることを確認する。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Add `projectEffects`: instantiate declared v1 effects at a selected boundary with the RBNF-consistent crossing rule and `INV-3` target checking. (`issues/open/20260706-project-effects-across-boundaries.md`)

## 注記

- 規範: `docs/responsible-v1.md` の「Effect の射影（Stage 2）」。着手は Stage 1 の受け入れ条件成立後。
- 2026-07-06: 実装完了（`src/effects.ts`、`src/__tests__/effects.test.ts`）。方針 4 の判断: effect は `ProcessView` に載せず独立した戻り値とした。フロー射影をバージョン非依存に保つためであり、viewer は `Effect.source.activityId` をコンポーネントの `activityIds` に対応付ける。戻り値は `{ ok, effects | issues }` の Result 形式とし、`INV-3` 違反は JSON パス付き issue で全件報告する。directed target の解決のため `src/boundary.ts` に `boundaryOfResponsibility` を追加した。
