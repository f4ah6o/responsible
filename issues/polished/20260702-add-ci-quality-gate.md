# CI に品質ゲート（check / typecheck / test / build）を追加する

Status: polished
Model: claude-fable-5
Created: 2026-07-02
Updated: 2026-07-02
Branch: ci/20260702-add-ci-quality-gate

## 概要

pull request と main への push で `pnpm run check`、`pnpm run typecheck`、`pnpm test`、build を実行する GitHub Actions workflow を追加し、検証されていない変更が main と GitHub Pages デプロイへ到達しない状態にする。

## 背景

- 現在の CI は `.github/workflows/pages.yml` のみで、main への push 時に `vp install` と `vp build` を実行して GitHub Pages へデプロイする。テスト、型検査、format / lint 検査は CI で実行されていない。
- ローカルには検証用スクリプトが揃っている（`package.json`）。
  - `pnpm run check`（`vp check`: format / lint / type checks）
  - `pnpm run typecheck`（`tsc -p tsconfig.json --noEmit`）
  - `pnpm test`（`node --test`、依存ゼロの `node:test` runner、現在 45 件成功）
  - `pnpm run build`（`vp build`）
- `pages.yml` は `voidzero-dev/setup-vp@v1`（node-version 24、cache 有効）と `vp install` を使用しており、新しい workflow も同じ toolchain 構成を再利用できる。
- `package.json` の `engines` は `node >=22.18.0`、`packageManager` は `pnpm@10.14.0` を指定している。

## 問題

- pull request をマージする前に、テスト失敗、型エラー、format / lint 違反を機械的に検出する仕組みがない。
- main が壊れた状態でも `pages.yml` はそのままビルド・デプロイを試みるため、公開デモが検証されていないコードから生成されうる。

## 目標

- pull request と main への push のたびに、check / typecheck / test / build が CI で自動実行され、結果が GitHub の status check として可視化される。
- 品質ゲートの実行内容がローカルの `pnpm run check` / `pnpm run typecheck` / `pnpm test` / `pnpm run build` と一致し、ローカルで成功した変更は CI でも成功する。

## 対象外

- ブランチ保護ルールの設定（GitHub リポジトリ設定であり、コード変更では完結しない）。
- `pages.yml` のデプロイジョブを CI 成功に依存させる構成変更（デプロイフローの変更は別イシューで扱う）。
- カバレッジ計測、リリース自動化、依存更新自動化の導入。

## 提案する方針

1. `.github/workflows/ci.yml` を新規作成する。トリガは `pull_request` と `push`（`branches: [main]`）とする。
2. `pages.yml` と同じ `voidzero-dev/setup-vp@v1`（node-version 24、cache 有効）で toolchain を準備し、`vp install` で依存を導入する。
3. 単一ジョブで次を順に実行する。
   - `pnpm run check`
   - `pnpm run typecheck`
   - `pnpm test`
   - `pnpm run build`

   `setup-vp` 環境で `pnpm` が利用できない場合は、同じ内容の直接呼び出し（`vp check`、`./node_modules/.bin/tsc -p tsconfig.json --noEmit`、`node --import ./tools/test-register.mjs --test "src/__tests__/**/*.test.ts"`、`vp build`）へ置き換え、`package.json` のスクリプトと内容が一致することを workflow 内のコメントで示す。
4. `permissions` は `contents: read` に限定する。
5. `concurrency` を設定し、同一 ref の古い実行をキャンセルする（`cancel-in-progress: true`）。

## 受け入れ条件

- [ ] `.github/workflows/ci.yml` が存在し、`pull_request` と main への `push` をトリガとする。
- [ ] CI ジョブが `pnpm run check`、`pnpm run typecheck`、`pnpm test`、`pnpm run build` をすべて実行する。
- [ ] いずれかのステップが失敗すると workflow が失敗として報告される。
- [ ] workflow の `permissions` が `contents: read` に限定されている。
- [ ] `pages.yml` の既存デプロイ動作が変更されていない。

## テスト計画

- ローカルで `pnpm install` 後に `pnpm run check && pnpm run typecheck && pnpm test && pnpm run build` を実行し、CI と同じコマンド列が成功することを確認する。
- ブランチを push して pull request を作成し、`ci.yml` が起動して成功することを GitHub Actions 上で確認する。
- 一時的にテストを失敗させたコミットを push し、CI が失敗として報告されることを確認する（確認後に revert する）。

## リスク

- `vite-plus`（`vp`）と `typescript` が `latest` 指定のため、CI 実行時点の最新版で挙動が変わり、ローカルと CI で結果が食い違う可能性がある。バージョン固定は別イシューの判断とし、本イシューでは現状の指定を変更しない。
- `setup-vp` の cache 前提が変わった場合は `pages.yml` と同時に更新が必要になる。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Add a CI quality gate workflow (`.github/workflows/ci.yml`) that runs format/lint/type checks, typecheck, tests, and build on pull requests and pushes to main. (`issues/open/20260702-add-ci-quality-gate.md`)

## 注記

- `pnpm run check`（`vp check`）と `pnpm run typecheck`（`tsc --noEmit`）は重複して型検査を行う可能性があるが、両者の検査範囲が同一であることが確認されるまでは両方を実行する。
- 2026-07-02: polish-issue: 品質基準を満たしたため polished へ遷移
