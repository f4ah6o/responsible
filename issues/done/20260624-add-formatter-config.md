# コードフォーマッタ設定を導入し整形を内容変更と分離する

Status: done
Model: GPT-5
Created: 2026-06-24
Updated: 2026-07-03
Branch: chore/20260624-add-formatter-config

## 概要

リポジトリにコミット済みのコードフォーマッタ設定と整形用スクリプトを導入し、整形だけの変更を内容変更と同じコミット・PR に混在させない運用を確立する。

## 背景

- `docs/2-document-semantic-core` ブランチのレビューで、`src/*.ts` と `src/styles.css` 全体に Prettier 風の整形（1行→複数行展開、`??`/`?:` への明示括弧付与、`package.json` のフィールド順入れ替え）が適用されていた。CSS だけで +488 / -90 行を占める。
- 当該ブランチの対象イシュー（`issues/done/20260624-document-semantic-core.md`）は「TypeScript core の実装変更は原則として対象外とする」と明記しており、整形の混入はその宣言と矛盾していた。
- リポジトリには `.prettierrc` 等のフォーマッタ設定、`.editorconfig`、`package.json` の `format`/`lint` スクリプトがいずれも存在しない。現行 toolchain では `vite-plus` が `vp format` / `vp check` を提供しており、`pnpm run check` は format / lint / type checks を実行しているが、整形の適用コマンドと運用方針は `package.json` や README から直接分からない。

## 問題

コミット済みのフォーマッタ設定が無いため、整形の基準が共有されず、貢献者ごとに再整形して大きな差分が発生する。整形と内容変更が同一コミットに混ざると、レビューで意味のある変更を見分けにくく、履歴の追跡も難しくなる。

## 目標

- 整形ルールがリポジトリにコミットされ、誰が実行しても同じ結果になる。
- 整形の確認・適用が単一コマンドで行える。
- 整形だけの変更を内容変更と分離する運用方針が文書化される。

## 対象外

- 既存の型チェックエラーの修正（別イシュー `20260624-fix-typecheck-errors.md` で扱う）。
- Lint ルール（コードの正しさ検査）の導入。スコープは整形に限定する。
- 既存ドキュメント（Markdown）の本文内容の変更。Markdown を整形対象に含めるかは方針判断として本イシュー内で決める。
- CI パイプラインの新規構築（既存があればフックする範囲にとどめる）。

## 提案する方針

1. 既存 toolchain の `vite-plus` を優先し、`package.json` に `format`（`vp format`）と `format:check`（`vp check` または `vp format --check` 相当があればそれ）を追加する。別フォーマッタ（Prettier 等）は、`vite-plus` で要件を満たせない場合だけ検討する。
2. `vp format` が対象拡張子と除外を内包しているかを確認し、追加設定が必要な場合のみ `.editorconfig` または toolchain 設定を導入する。不要な `.prettierrc` は追加しない。
3. 一度だけリポジトリ全体に整形を適用し、その整形コミットを内容変更と分けて単独コミットにする。
4. 「整形だけの変更は独立コミット・独立 PR にする」運用方針を README または貢献ガイドに1〜2文で明記する。

## 受け入れ条件

- [ ] `package.json` に `format` と `format:check`（または同等の検査専用）スクリプトが追加されている。
- [ ] `pnpm run format:check`（または同等コマンド）が整形済みコードに対して終了コード 0 を返す。
- [ ] `pnpm run format` が冪等であり、2回連続実行で差分が出ない。
- [ ] 新しいフォーマッタ依存を追加する場合は `devDependencies` のみに追加され、コア実行時依存が増えていない。`vite-plus` で足りる場合は依存を追加しない。
- [ ] 整形だけの変更を内容変更から分離する方針が文書化されている。

## テスト計画

- `pnpm run format` を2回実行し、2回目の後に `git diff` が空になることを確認する（冪等性）。
- `pnpm run format:check` を実行し終了コード 0 を確認する。
- `pnpm run check` と `pnpm run build` が引き続き成功することを確認する。
- 任意のファイルをわざと崩して `pnpm run format:check` が失敗することを確認する。

## リスク

- 全体整形コミットは広範な差分を生み、進行中のブランチとコンフリクトしやすい。先行ブランチのマージ後に実施するなど順序を調整する。
- フォーマッタの既定スタイルが既存コードと微妙に異なると、初回整形で意図せぬ変更が出る。初回 PR で差分を確認してから設定を確定する。
- Markdown を対象に含めると `docs/` の表整形などが変わり得る。対象拡張子は段階的に広げる。

## 変更履歴

`CHANGES.md` impact: no

## 注記

- 本イシューは `docs/2-document-semantic-core` のレビュー指摘（範囲外の整形混入）から派生した。設定不在が根本原因のため、当該ブランチの整形をどう扱うか（取り消すか別コミットに切り出すか）は本イシューの方針確定後に判断する。
- 2026-06-27: Polished against current toolchain. `vite-plus` already provides `vp format` and `vp check`; prefer exposing those through package scripts before adding Prettier or another formatter.
- 2026-07-03: Started implementation from the polished backlog.
- 2026-07-03: Implemented and verified with formatter/check/typecheck/test/build workflow.
