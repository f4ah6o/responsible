# 実務レベルの業務フロー作成と発見

[English](workflow-discovery.md) | 日本語

本文書は、実務レベルの業務フロー作成・発見に関する規範文書である。対象は `tool` 境界レベル、`responsible.oplog.v0` JSONL 形式、発見済み `ProcessModel` への決定的変換、Windows 操作記録スクリプトである。意味論について [`semantic-core.ja.md`](semantic-core.ja.md) と矛盾する場合は意味論コアを優先し、操作ログの形式と発見変換規則については本文書を優先する。

## 目的

担当者がフォアグラウンドウィンドウの遷移を記録し、`status: "discovered"` の Activity 列へ変換し、既存の責任境界射影で確認できるようにする。

元の `ProcessModel` は発見した出現を時系列で保持する。境界射影は設計上、情報を畳み込む。

- `tool` 射影は、同じツール境界に解決される隣接 Activity をまとめる。
- `person` 射影は、同じ担当者境界に解決される隣接 Activity をまとめる。
- 出現単位の詳細は、射影前の `ProcessModel` を正とする。

したがって `tool` ビューはツール単位の連続区間を見るビューであり、すべての出現を保持するトレースビューではない。出現を一切畳み込まない専用ビューは将来拡張とし、本設計の対象外とする。

## スコープ

本設計は次を追加する。

1. viewer の最詳細階層として `tool` を追加する: `company < department < section < team < person < tool`。
2. ローカル JSONL 形式 `responsible.oplog.v0`。
3. フラットでサイクルのない `ProcessModel` を生成する純粋な発見コンバータ。
4. フォアグラウンドウィンドウのメタデータだけを取得する、本人同意型の Windows 記録スクリプト。

頻度分析、分岐推定、複数トレース統合、隠蔽監視、キーロギング、画面取得、クリップボード取得、自動アップロードは対象外である。

## `tool` 境界レベル

`tool` は Excel、Outlook、ブラウザ、紙、電話など、Activity の遂行手段を表す。viewer が利用する責任軸の一つであり、新しい意味論プリミティブではない。

```text
company < department < section < team < person < tool
```

既存の射影規則は変更しない。同じ選択境界を持つ隣接 Activity は quotient として畳み込まれる。

- 2つの Excel ウィンドウを切り替えた場合、正規化タイトルが異なれば元モデルでは別 Activity になるが、Excel → Excel が隣接する `tool` 射影では1つの composite になる。
- Excel → Outlook → Excel は、同じ Excel が隣接していないため `tool` 射影でも3ノードになる。
- 全作業を同じ担当者が行った場合、`person` 射影ではさらに長い連続区間が畳み込まれ得る。

`tool` 軸を持たないモデルは、既存の責任軸と同様に `tool` レベルで `<unassigned>` に解決される。

## `responsible.oplog.v0`

形式は JSONL とし、空行を除く1行に1つの JSON オブジェクトを置く。

```ts
type OpLogEntry = OpLogHeader | OpLogFocus | OpLogIdle | OpLogResume | OpLogNote;

type OpLogHeader = {
  kind: "header";
  schemaVersion: "responsible.oplog.v0";
  person?: string;
  machine?: string;
  startedAt?: string; // Z または数値オフセット付き RFC 3339
};

type OpLogFocus = {
  kind: "focus";
  t: string; // Z または数値オフセット付き RFC 3339
  person?: string;
  app: { exe: string; name?: string };
  window: { title: string }; // 空文字列不可
};

type OpLogIdle = { kind: "idle"; t: string };
type OpLogResume = { kind: "resume"; t: string };
type OpLogNote = { kind: "note"; t: string; text: string };
```

`focus` の担当者は `entry.person ?? header.person` で解決し、結果は空であってはならない。

```jsonl
{"kind":"header","schemaVersion":"responsible.oplog.v0","person":"佐藤","machine":"PC-0123","startedAt":"2026-07-06T09:00:00+09:00"}
{"kind":"focus","t":"2026-07-06T09:00:12+09:00","app":{"exe":"OUTLOOK.EXE","name":"Outlook"},"window":{"title":"受信トレイ - Outlook"}}
{"kind":"focus","t":"2026-07-06T09:04:30+09:00","app":{"exe":"EXCEL.EXE","name":"Excel"},"window":{"title":"見積A.xlsx - Excel"}}
{"kind":"focus","t":"2026-07-06T09:08:10+09:00","app":{"exe":"EXCEL.EXE","name":"Excel"},"window":{"title":"見積B.xlsx - Excel"}}
{"kind":"idle","t":"2026-07-06T09:35:00+09:00"}
{"kind":"resume","t":"2026-07-06T09:50:00+09:00"}
```

## 検証

`parseOperationLogJsonl` は、すべての問題を1始まりの行番号付きで報告する。次を拒否する。

- 不正 JSON、配列、プリミティブ、未知の `kind`。
- 必須フィールドの欠落または空文字列。
- 最初の非空行以外に置かれた `header`。
- `schemaVersion` が `responsible.oplog.v0` ではないヘッダ。
- 解決後の担当者が空の `focus`。
- 空の `focus.app.exe` または `focus.window.title`。
- 不正な時刻。
- `focus` が1件もない文書。空、ヘッダのみ、idle のみのログを含む。

文書全体に関する `focus` 欠落は、空入力でも issue の形を統一できるよう1行目の問題として報告する。

時刻検証を `Date.parse` だけに依存させてはならない。次をすべて満たす場合のみ受理する。

1. v0 の明示形式 `YYYY-MM-DDTHH:mm:ss[.fraction](Z|±HH:mm)` に一致する。
2. 実在する日付であり、時刻とオフセットの各値が有効である。
3. 有限の時点としてパースできる。

日付だけの文字列、ロケール依存文字列、オフセットなし時刻、存在しない日付、うるう秒 `:60` は v0 で拒否する。`t` と任意の `header.startedAt` に同じ規則を適用する。

## 発見変換

```ts
discoverProcessModel(entries, options) -> ProcessModel
```

純粋かつ決定的な関数とする。

### 1. 解決と正規化

各 `focus` について次を行う。

- エントリまたはヘッダから `person` を解決する。
- `app.exe` を trim し、Windows の大文字小文字を区別しない同一性に合わせて正規化し、`normalizedExe` を得る。
- `app.name` は任意の表示用メタデータとしてのみ保持する。
- `options.titleRules` を順番に適用して `normalizedTitle` を得る。

既定のタイトル規則は空配列である。1つのログ内で安定したツール同一性には、任意の表示名ではなく `normalizedExe` を使う。

### 2. 安定ソート

検証済み時刻で安定ソートし、同一時刻では元の行順を維持する。

### 3. セグメント化

セグメントキーは次とする。

```text
(解決後の person, normalizedExe, 正規化 title)
```

直前の `focus` とキーが等しい場合だけ現在のセグメントへ結合する。次の場合は必ず新しいセグメントを開始する。

- 解決後の担当者が変わった。
- アプリまたは正規化タイトルが変わった。
- 間隔が `options.gapMinutes`（既定15分）を超えた。
- 間に `idle` がある。

担当者をキーへ含めることで、同じアプリ・同じタイトルを使う担当者間の引き継ぎを失わない。

### 4. Activity 合成

セグメント順に1つずつ Activity を作る。

- `id`: `op-001`, `op-002`, ...。
- `name`: 正規化タイトル。空になった場合は `app.name ?? app.exe`。
- `input` / `output`: `"Unknown"`。
- `responsibility`: `{ ...options.responsibility, person, tool }`。`tool = normalizedExe`。
- `status`: `"discovered"`。

`types` に `Unknown: { kind: "primitive" }` を含める。将来のスキーマで `app.name` を責任境界の外側に表示用メタデータとして保持してもよいが、その有無で `tool` の同一性を変えてはならない。

### 5. Flow 合成

隣接するセグメント対にだけ1本ずつ flow を作る。再訪時も別 Activity ID を使うため、A → B → A は `op-001 → op-002 → op-003` となり、グラフ上のサイクルにはならない。

### 6. 文書形状

フラットな `responsible.v0` モデルを返す。ルート Activity や既定 view は追加しない。既存の読み込み経路が必要に応じて `ensureRootActivity` を適用する。

## 射影に関する期待値

テストでは、元モデルでの出現保持と境界射影を区別する。

- 元モデルは、すべての発見セグメントと隣接 flow を保持する。
- `tool` 射影は既存の quotient 規則に従い、同じツールの隣接セグメントを畳み込み得る。
- 同じ実行ファイルのセグメントは、一部のエントリだけに `app.name` がある場合も同じ `tool` 境界へ解決される。
- 同じツールでも非隣接の再訪は別ノードとして残る。
- `person` 射影では、より長い連続区間が畳み込まれ得る。
- 担当者変更をまたいで person レベルの畳み込みをしてはならない。

RBNFを回避する目的で、出現IDを `tool` 境界へ混入させてはならない。ツール軸とトレース同一性を混同し、境界射影の意味を壊すためである。

## 記録スクリプト要件

Windows 記録スクリプトは、パーサが受理できるログだけを出力する。

`GetWindowTextW` で空でないタイトルを得られない場合は、次の順で空でない値を `window.title` に書く。

1. `app.name` が取得できる場合は `app.name`。
2. それ以外は `app.exe`。

`window.title: ""` を出力してはならない。

時刻は明示オフセット付き RFC 3339 とする。記録対象はアプリ実行ファイル名・表示名、ウィンドウタイトル、時刻、担当者、マシン情報だけである。

## プライバシー原則

1. **メタデータのみ:** キー入力、画面、クリップボード、タイトル以外のウィンドウ内容を記録しない。
2. **本人同意と自己利用:** 記録される本人が自分の業務フロー発見のために開始・停止する。
3. **保存前マスキング:** タイトルのマスキングをファイル書き込み前に行い、生タイトルを永続化しない。
4. **ローカル完結:** ネットワーク送信、リモート収集、隠蔽起動、自動アップロードを実装しない。

## 段階的実装

| Stage | スコープ                                             | Issue                                                    |
| ----- | ---------------------------------------------------- | -------------------------------------------------------- |
| 1     | `tool` 階層・viewer 対応と射影テスト                 | `issues/open/20260707-add-tool-boundary-level.md`        |
| 2     | oplog パース、発見変換、CLI、例、テスト              | `issues/open/20260707-define-oplog-and-discovery.md`     |
| 3     | 本人同意型 Windows 記録スクリプトと形式検証          | `issues/open/20260707-add-windows-operation-recorder.md` |

## 表明可能な部分集合

Stage 2 完了後、次を自動テストする。

- オフセット付き RFC 3339 の明示検証。日付のみ、オフセットなし、ロケール形式、存在しない日付を拒否する。
- 行番号付きのパーサ問題報告と、`focus` がないログの拒否。
- 担当者、アプリ、タイトル、gap、idle によるセグメント分割。
- 往復トレースのサイクルなし合成。
- 元モデルでの出現保持。
- 正規化済み実行ファイル名に基づく安定した `tool` 同一性。
- `tool` / `person` 境界での quotient 挙動。
- 担当者引き継ぎの保持。
- `status`、`responsibility`、`Unknown` 型の妥当性。
