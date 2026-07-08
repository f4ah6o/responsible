# リリース手順

[English](release.md) | 日本語

`@f4ah6o/responsible` のリリースを切る手順。

## 手順

1. **`CHANGES.md` を更新する。** `## Unreleased` 配下のエントリを、その直下に
   新設する `## <version> - <YYYY-MM-DD>` 節へ移す。そのうえで、同じ
   `### Added` / `### Changed` / `### Fixed` / `### Deprecated` /
   `### Removed` / `### Security` / `### Migration` の小見出しを持つ空の
   `## Unreleased` 節を先頭に追加する。
2. **バージョンを上げる。** `package.json` の `version` を新設した
   `## <version>` 見出しと一致させ、両ファイルを `main` にコミットする
   (例: `chore: release 0.2.0`)。
3. **リリースワークフローを実行する。** Actions タブから
   [`Release`](../.github/workflows/release.yml)(`workflow_dispatch`)を、
   `version` に同じ値(先頭に `v` を付けない。例: `0.2.0`)を指定して実行する。
   ワークフローは以下を行う。
   - 品質ゲート(`check` / `typecheck` / `test` / `build`)を実行する
   - 入力値が `package.json` の `version` と一致することを検証する
   - 該当する `CHANGES.md` の節を抽出する(`tools/extract-changelog.mjs`)
   - `v<version>` タグを作成して push する
   - そのタグから、抽出した内容を本文とする GitHub Release を作成する
   - `NPM_TOKEN` リポジトリ secret が設定されていれば npm に publish し、
     未設定なら publish をスキップしてそのまま成功する

品質ゲートまたはバージョン検証のいずれかが失敗した場合、タグと Release の
作成前にワークフローは停止する。

## 前提条件

- `NPM_TOKEN`: `@f4ah6o/responsible` への publish 権限を持つ npm automation
  token。リポジトリ secret として設定する。任意項目であり、未設定でも
  タグと GitHub Release の作成のみは行われる。
