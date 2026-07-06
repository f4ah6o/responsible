# responsible.v1 スキーマコアを実装する（Stage 1）

Status: done
Model: Claude
Created: 2026-07-06
Updated: 2026-07-06
Branch: claude/responsible-v1-impl-xkq73q

## 概要

`docs/responsible-v1.md` の Stage 1 として、`responsible.v1` のモデル型（`requires` / `ensures` / `effects`）、二重バージョン検証、v0 → v1 マイグレーションをコアに実装する。射影と viewer は対象外（Stage 2 / 3）。

## 背景

- `docs/semantic-core.md` は `requires` / `ensures` / `Effect` を future semantic target と定義しているが、v0 のモデル文書にはそれを書く場所がない。
- `src/semantic.ts` には plain-data の `Effect` 型と `validateDirectedEffect` が既にあるが、モデル文書からは生成できない。
- `docs/nonlinear-projection.md` は「非線形 projection は v1 を必要としない」と既に決定しており、v1 の存在理由は契約と作用の宣言である。

## 問題

- モデル文書に契約と作用を書けないため、`effects = project(ensures, boundary)` という意味論のコア関係を data として表明できない。
- スキーマバージョンが 1 つしかなく、スキーマ拡張の受け入れ経路（検証・マイグレーション）が存在しない。

## 目標

- `responsible.v1` 文書がパース・検証でき、v0 文書が `migrateProcessModelToV1` で v1 に移行できる状態。

## 対象外

- `projectEffects` と `INV-3` の射影時検査（Stage 2）。
- viewer の effect 描画、サンプル・example の追加（Stage 3）。
- 実行 API、記号的述語、ループ・並行意味論（`docs/responsible-v1.md` の「v1 でないもの」）。

## 提案する方針

1. `src/model.ts` に `SchemaVersion`（v0 / v1 の union）、`FactRef`、`EffectPayloadDef`、`EffectDeliveryDef`、`EffectDef` を追加し、`ActivityDef` に `requires` / `ensures` / `effects` をオプショナルに追加する。directed の target は `Responsibility` レコード（境界式非依存）。
2. `src/validate.ts` を二重バージョン対応にする。v0 文書中の v1 フィールドはバージョンヒント付きエラー、v1 文書では構造検証（JSON パス付き）。
3. `src/migrate.ts` に `migrateProcessModelToV1`（schemaVersion の書き換えのみ、v1 入力はそのまま返す）を追加し、`src/index.ts` から re-export する。
4. `node:test` スイート `src/__tests__/v1-schema.test.ts` を追加し、既存の schemaVersion 拒否テストを未知バージョン（`responsible.v2`）に更新する。

## 受け入れ条件

- [x] `requires` / `ensures` / `effects` を含む `responsible.v1` 文書が `validateProcessModel` を通過する。
- [x] v0 文書に v1 フィールドがある場合、該当フィールドの JSON パスでエラーになる。
- [x] 不正な `effects`（未知の payload kind / delivery mode、directed の target 欠落・空）が JSON パス付きで報告される。
- [x] `migrateProcessModelToV1` が v0 文書の schemaVersion のみを書き換え、v1 文書には冪等である。
- [x] 既存テストを含め `pnpm run check && pnpm run typecheck && pnpm test && pnpm run build` が通る。

## テスト計画

- `src/__tests__/v1-schema.test.ts`: v1 受理、v0 での v1 フィールド拒否、malformed effects の JSON パス、マイグレーションの上位集合性・冪等性、v1 文書の射影がバージョン非依存であること。
- `src/__tests__/validate.test.ts`: 未知の schemaVersion（`responsible.v2`）の拒否に更新。

## リスク

- `ProcessModel.schemaVersion` の型が literal から union に広がるため、literal に依存する既存コードが壊れる可能性がある。typecheck とテストで検出する。
- Stage 2 で `EffectDef` の形が不足と判明した場合はスキーマ改訂が必要になるが、v1 は未リリースのため許容する。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Define the `responsible.v1` schema (declarative `requires` / `ensures` / `effects`) and implement its schema core: model types, dual-version validation, and `migrateProcessModelToV1`. (`issues/done/20260706-implement-v1-schema-core.md`)

## 注記

- 規範文書は `docs/responsible-v1.md`（日英ペア）。
- 2026-07-06: 設計文書と同時に実装。Stage 2 / 3 は `issues/open/` に分割。
