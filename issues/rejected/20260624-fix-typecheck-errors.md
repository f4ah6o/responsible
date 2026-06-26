# 既存の型チェックエラーを解消する

Status: rejected
Model: GPT-5
Created: 2026-06-24
Updated: 2026-06-27
Branch: fix/20260624-fix-typecheck-errors

## 概要

`npm run typecheck` が現状で2件のエラーにより失敗するため、これらを解消し、型チェックがクリーンに通る状態にする。

## 背景

- `package.json` の `typecheck` スクリプトは `tsc -p tsconfig.json --noEmit`。
- `docs/2-document-semantic-core` ブランチのレビュー中に発覚した。`git stash` でベース（`main` HEAD `2a3f3c0`）に戻しても同一エラーが再現するため、特定の作業で混入したものではなく既存の問題である。
- 該当箇所:
  - `src/boundary.ts` — `boundaryOf` 内で `Array.isArray(boundary)` ガードの後、`BoundaryExpr`（`string | readonly string[]`）の `readonly string[]` が絞り込まれず、`resolveBoundaryValue(activity, key: string)` の `string` 引数に渡せない。`Array.isArray` の型述語は `arg is any[]` であり `readonly` 配列メンバーをユニオンから除去しないという TypeScript の既知の挙動が原因。
  - `src/main.ts:1` — `import "./styles.css"` の side-effect import に対する型宣言（ambient module declaration）が存在しない（TS2882）。

## 問題

型チェックが恒常的に失敗しているため、`npm run typecheck` を CI やレビューの品質ゲートとして信頼できない。`boundary.ts` の件は配列分岐の型の穴であり、将来 `boundaryOf` 周辺を変更した際に実際の型不整合を見逃すリスクになる。

## 目標

`npm run typecheck` が終了コード 0 で完了し、エラー・警告が出ない状態にする。実行時の挙動は変えない。

## 対象外

- コードの整形やフォーマッタ設定の導入（別イシュー `20260624-add-formatter-config.md` で扱う）。
- `boundaryOf` / `resolveBoundaryValue` の機能拡張やシグネチャの再設計。
- `tsconfig.json` の `strict` 関連オプションの方針変更。
- ドキュメントの変更。

## 提案する方針

1. `src/boundary.ts` の `boundaryOf` で配列分岐を型安全に絞り込む。`Array.isArray` に依存せず `BoundaryExpr` の判別ができるよう、`if (Array.isArray(boundary))` の後で残余を `string` に確定させる型述語ヘルパ（例: `function isBoundaryKey(b: BoundaryExpr): b is string`）を導入するか、配列分岐を早期 return した上で残りを明示的に `string` として扱う。実行時の早期 return の意味は現状維持する。
2. `import "./styles.css"` の型を解決するため、ambient 宣言（例: `src/css.d.ts` に `declare module "*.css";`）を追加する。`tsconfig.json` の `include` が `src` 配下を拾うことを確認する。
3. 変更後に `npm run typecheck` を実行し、両エラーが解消したことを確認する。

## 受け入れ条件

- [ ] `npm run typecheck` がエラー・警告なしで終了コード 0 になる。
- [ ] `src/boundary.ts` の `boundaryOf` が、文字列境界・配列（複合）境界の両方で型エラーなくコンパイルされ、実行時の出力（`key:value` 形式・`|` 結合）が変わらない。
- [ ] `src/main.ts` の `import "./styles.css"` が型エラーを出さない。
- [ ] `npm run check`（`vp check`）が引き続き成功する。

## テスト計画

- `npm run typecheck` を実行し、出力が空で終了コード 0 であることを確認する。
- `npm run check` を実行して回帰がないことを確認する。
- `boundaryOf` を文字列境界（例 `"department"`）と複合境界（例 `["project", "function"]`）の双方で呼び、戻り値が変更前と一致することを目視またはアドホックなスクリプトで確認する。

## リスク

- `Array.isArray` の絞り込み回避を誤ると、配列分岐の実行時挙動を変えてしまう恐れがある。早期 return の意味を保つこと。
- `*.css` の ambient 宣言が広すぎると、将来 CSS Modules を導入した際に型情報を弱める可能性がある。当面は side-effect import のみを対象とする最小宣言にとどめる。
- ロールバックは各変更を個別に元に戻すだけで可能。

## 変更履歴

`CHANGES.md` impact: no

## 注記

- レビュー時の再現コマンド: `git stash push -- src/ package.json && npm run typecheck && git stash pop`。
- 整形の混入とは独立した問題のため、別イシュー（フォーマッタ設定）とは別ブランチで対応する。
- 2026-06-27: Superseded by issues/polished/20260624-align-reference-impl-semantic-core.md; the typecheck fixes are implemented and pnpm run typecheck passes.
