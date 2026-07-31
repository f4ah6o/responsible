# `responsible.oplog.v0` と発見コンバータを実装する（Stage 2）

Status: open
Model: Claude
Created: 2026-07-07
Updated: 2026-07-31

## 概要

[`docs/workflow-discovery.md`](../../docs/workflow-discovery.md) に従い、JSONL パーサ、発見変換の純関数、CLI、例、テストを実装する。

## 実装対象

### 1. 型とパーサ

`src/discover/oplog.ts` を追加する。

```ts
parseOperationLogJsonl(text):
  | { ok: true; entries: OpLogEntry[] }
  | { ok: false; issues: { line: number; message: string }[] }
```

検証要件:

- 不正 JSON、非オブジェクト、未知 `kind` を拒否する。
- `header` は最初の非空行だけ許可する。
- `schemaVersion` を厳密に検証する。
- `focus` の担当者を `entry.person ?? header.person` で解決し、空なら拒否する。
- `app.exe` と `window.title` は空文字列不可とする。
- `t` と任意の `header.startedAt` は明示的なオフセット付き RFC 3339 として検証する。
- `focus` が1件もない空、ヘッダのみ、idle のみのログを拒否し、文書全体の問題を1行目として報告する。

時刻検証は `Date.parse` の `NaN` 判定だけで済ませない。少なくとも次を組み合わせる。

1. `YYYY-MM-DDTHH:mm:ss[.fraction](Z|±HH:mm)` への完全一致。
2. 年月日、時分秒、オフセット各値の範囲と実在日付の確認。
3. 有限の instant へ変換できることの確認。

v0 では日付だけ、ロケール形式、オフセットなし、存在しない日付、`:60` のうるう秒を拒否する。

### 2. 発見変換

`src/discover/discover.ts` を追加する。

```ts
discoverProcessModel(entries, options): ProcessModel
```

処理順:

1. 担当者を解決する。
2. `app.exe` を trim し、Windows の大文字小文字を区別しない同一性に合わせた `normalizedExe` へ正規化する。
3. `app.name` は任意の表示用メタデータとしてのみ扱う。
4. タイトル正規化規則を順に適用する。
5. 時刻で安定ソートする。
6. セグメント化する。
7. Activity と隣接 flow を合成する。

セグメントキー:

```text
(resolved person, normalizedExe, normalized title)
```

次の場合は新しいセグメントを開始する。

- 担当者が変わった。
- アプリまたは正規化タイトルが変わった。
- `gapMinutes`（既定15分）を超えた。
- 間に `idle` がある。

担当者をキーへ含め、同じアプリ・同じタイトルを使う担当者間の引き継ぎを失わないこと。

### 3. 出力モデル

各セグメントから次を生成する。

- `id`: `op-001` 形式。
- `name`: 正規化タイトル。空なら `app.name ?? app.exe`。
- `input` / `output`: `Unknown`。
- `responsibility`: 固定軸 + 解決後 `person` + `tool: normalizedExe`。
- `status`: `discovered`。

`app.name` の有無で `tool` 境界を変えてはならない。同じ実行ファイルについて表示名取得が成功した行と失敗した行が混在しても、同じ `tool` に解決すること。

隣接セグメントだけを flow で結ぶ。再訪は別IDにするため、A → B → A もグラフ上のサイクルにならない。

### 4. 射影との整合

元モデルと射影結果を混同しない。

- 元モデルは全セグメントを保持する。
- 同じツールの隣接セグメントは `tool` 射影で composite になり得る。
- Excel → Outlook → Excel のような非隣接再訪は別ノードとして残る。
- `person` 射影は同一担当者のより長い連続区間を畳み込み得る。
- 担当者変更をまたいで畳み込まない。

`tool` 値へ出現IDを埋め込んで既存RBNFを回避してはならない。

### 5. CLI と例

- `tools/oplog-to-model.mjs`
- `examples/oplog-sample.jsonl`
- `examples/oplog-sample.discovered.json`

パース問題は行番号付きで stderr に出し、失敗時は exit 1。生成後に `validateProcessModel` を実行する。

## 受け入れ条件

- [ ] 正常ログをパースできる。
- [ ] 不正 JSON、必須値欠落、ヘッダ位置、担当者欠落を行番号付きで報告する。
- [ ] 空、ヘッダのみ、idle のみなど `focus` がないログを拒否する。
- [ ] 日付のみ、ロケール形式、オフセットなし、存在しない日付を拒否する。
- [ ] 同一担当者・アプリ・タイトルの連続 focus を併合する。
- [ ] 担当者変更、gap、idle、アプリ変更、タイトル変更で分割する。
- [ ] 往復ログからサイクルのない線形モデルを生成する。
- [ ] 元モデルで全セグメントが保持される。
- [ ] 同じ exe で `app.name` の有無が混在しても同じ `tool` 境界へ解決される。
- [ ] `tool` 射影で同一ツールの隣接セグメントが既存規則どおり composite になる。
- [ ] 担当者変更をまたいで person composite が作られない。
- [ ] 出力が `validateProcessModel` を通る。
- [ ] CLI の生成物を viewer へ読み込める。
- [ ] リポジトリの全品質ゲートが通る。

## テスト計画

- RFC 3339 正常値: `Z`、正負オフセット、小数秒。
- RFC 3339 異常値: `2026-07-06`、`July 6, 2026`、オフセットなし、2月30日、25時、無効オフセット、うるう秒。
- 空ログ、ヘッダのみ、idle/resume のみを missing-focus issue として拒否する。
- 担当者引き継ぎ: 同じ exe/title でも person が変われば別 Activity。
- ツール同一性: 同じ exe の一方だけに `app.name` があっても同じ tool boundary。
- 同一ツール別タイトル: 元モデルでは別 Activity、tool 射影では隣接 composite。
- 往復: Excel → Outlook → Excel は tool 射影でも3ノード。
- gap / idle / titleRules / stable sort。

## 対象外

- Windows 記録（Stage 3）。
- 複数トレース統合、頻度分析、分岐推定。
- 出現を一切畳み込まない専用トレースビュー。
