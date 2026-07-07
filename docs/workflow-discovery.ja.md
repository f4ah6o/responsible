# 実務レベルの業務フロー作成と発見

[English](workflow-discovery.md) | 日本語

本文書は、担当者/実務レベルでの業務フローの作成・発見機能 — `tool` 境界レベル、操作ログ形式 `responsible.oplog.v0`、発見コンバータ、Windows 操作記録スクリプト — に対する規範文書である。意味論について [`docs/semantic-core.md`](semantic-core.ja.md) と食い違う場合は `docs/semantic-core.md` が優先し、ログスキーマと発見規則の形は本文書が優先する。

## 動機

業務フローを実務レベル(誰が・どのツール/アプリで・何をしたか)まで書き下すと、通常は粒度が細かすぎて収拾がつかなくなる。responsible ではそうならない: ビューは射影であり、RBNF が同一境界の連続 Activity を畳み込むため、ツール粒度で**作成または発見**したフローは、境界ズームを粗くするだけで担当者・チーム・部門レベルの一貫したビューに畳み込まれる。つまり最も細かい粒度で一度だけ記録すれば、上位レベルでの整理は射影が自動的に行う。

この性質を使うために、次の 3 つを追加する:

1. **`tool` 境界レベル** — レーンに利用ツール/アプリまで書けるようにする(viewer の階層境界ズームの最詳細レベル)。
2. **操作ログ形式 `responsible.oplog.v0` と発見コンバータ** — 操作記録(フォアグラウンドウィンドウの遷移ログ)から `status: "discovered"` の Activity 列として `ProcessModel` を合成する。
3. **Windows 操作記録スクリプト** — 実務者の PC 上でフォアグラウンドウィンドウの切替を `responsible.oplog.v0` として記録する。

## 本機能でないもの

- **意味論コアの変更はない。** `tool` は新しいモデリングプリミティブではなく、元々任意である `responsibility` の軸の 1 つに対する viewer 規約(階層境界順序への追加)である。
- **プロセスマイニングではない。** 発見コンバータは頻度分析・分岐推定・トレースのマージを行わない。1 本のログは 1 本の線形パス(トレース)になる。複数トレースの統合と往復の集約はループ意味論が未定義である限りスコープ外(コアはサイクルを拒否する)。
- **実行監視・キーロギングではない。** 記録するのはアプリ名とウィンドウタイトルのメタデータのみ。キーストローク・画面内容・クリップボードは記録しない(後述のプライバシー原則)。

## `tool` 境界レベル

viewer の階層境界順序(`src/hierarchy.ts` の `HIERARCHICAL_BOUNDARY_ORDER`)を次のとおり拡張する:

```text
company < department < section < team < person < tool
```

- `tool` 軸の値は、その Activity を遂行するのに使う道具(アプリケーション、SaaS、紙、電話など)の名前である。責任の帰属(誰が)ではなく遂行手段(何で)を表すが、レーン軸としては他の軸と同格に扱う: `boundaryOf` の解決規則、入れ子レーンの構築、RBNF の畳み込みはすべて既存の規則のままである。
- `tool` 軸を持たないモデルは、`tool` ズームで `<unassigned>` レーンに解決される。これは `person` 軸を持たないモデルの既存挙動と同一であり、後方互換である。
- 境界ズームを `person` に粗くすると、同一担当者が複数ツールをまたいで行う連続作業は RBNF により 1 ノードに畳み込まれる。これが本機能の要である。

## 操作ログ形式 `responsible.oplog.v0`

操作ログは JSONL(1 行 = 1 JSON 値)である。行は時刻順であることが望ましいが、コンバータは `t` で安定ソートしてから処理する。

### エントリ種別

```ts
type OpLogEntry = OpLogHeader | OpLogFocus | OpLogIdle | OpLogResume | OpLogNote;

// 先頭行に置ける任意のヘッダ。後続エントリの既定値を与える。
type OpLogHeader = {
  kind: "header";
  schemaVersion: "responsible.oplog.v0";
  person?: string; // 後続エントリの person 既定値
  machine?: string; // 記録元マシン名(参考情報)
  startedAt?: string; // RFC 3339
};

// フォアグラウンドウィンドウの切替(v0 の中核。これだけで発見は成立する)
type OpLogFocus = {
  kind: "focus";
  t: string; // RFC 3339(オフセット付き)
  person?: string; // ヘッダに既定値がなければ必須
  app: { exe: string; name?: string }; // 例 { "exe": "EXCEL.EXE", "name": "Excel" }
  window: { title: string };
};

// 入力アイドルの開始/終了(任意)
type OpLogIdle = { kind: "idle"; t: string };
type OpLogResume = { kind: "resume"; t: string };

// 手動注記(任意)。v0 のコンバータは保存せず無視する(将来の拡張のため予約)。
type OpLogNote = { kind: "note"; t: string; text: string };
```

例(記録スクリプトの実出力イメージ):

```jsonl
{"kind":"header","schemaVersion":"responsible.oplog.v0","person":"佐藤","machine":"PC-0123"}
{"kind":"focus","t":"2026-07-06T09:00:12+09:00","app":{"exe":"OUTLOOK.EXE","name":"Outlook"},"window":{"title":"受信トレイ - 佐藤 - Outlook"}}
{"kind":"focus","t":"2026-07-06T09:04:30+09:00","app":{"exe":"EXCEL.EXE","name":"Excel"},"window":{"title":"見積_2026-07.xlsx - Excel"}}
{"kind":"focus","t":"2026-07-06T09:21:05+09:00","app":{"exe":"OUTLOOK.EXE","name":"Outlook"},"window":{"title":"RE: お見積りの件 - メッセージ - Outlook"}}
{"kind":"idle","t":"2026-07-06T09:35:00+09:00"}
{"kind":"resume","t":"2026-07-06T09:50:00+09:00"}
```

### 検証

パーサ(`parseOperationLogJsonl`)は行番号付きで問題を報告する(モデル検証の JSON パス報告に対応する規約):

- 行が JSON として不正 / オブジェクトでない。
- `kind` が未知、または必須フィールド(`t`、`focus` の `app.exe` / `window.title`、person の既定値がない場合の `person`)の欠落・空文字列。
- `t` が RFC 3339 としてパースできない。
- `header` が先頭行以外に現れる、または `schemaVersion` が `responsible.oplog.v0` でない。

## 発見規則(ログ → `ProcessModel`)

`discoverProcessModel(entries, options) -> ProcessModel` は純関数であり、次の規則で決定的に合成する:

1. **正規化**: 各 `focus` エントリの `window.title` に `options.titleRules`(`{ pattern, replace }` の列。`pattern` は正規表現文字列)を順に適用し、正規化タイトルを得る。既定は無変換。推奨例: `{ "pattern": " - Excel$", "replace": "" }` のようなアプリ名サフィックスの除去。
2. **セグメント化**: `t` で安定ソートした `focus` 列を走査し、キー `(app.exe, 正規化タイトル)` が直前と同じエントリを同一セグメントに併合する。次の場合はキーが同じでもセグメントを打ち切り、新しい出現(occurrence)を開始する:
   - 直前の `focus` との間隔が `options.gapMinutes`(既定 15 分)を超える。
   - 間に `idle` エントリがある。
3. **Activity 合成**: セグメント i(1 始まり)ごとに 1 つの Activity を作る:
   - `id`: `op-001` 形式(ゼロ埋め 3 桁以上、セグメント順)。
   - `name`: 正規化タイトル(空なら `app.name ?? app.exe`)。
   - `input` / `output`: `"Unknown"`。`types` に `Unknown: { kind: "primitive" }` を含める。操作ログからデータ型は発見できないため、型付けは人が `discovered` → `defined` に引き上げる際の作業として残す。
   - `responsibility`: `{ ...options.responsibility, person, tool }`。`person` はエントリ(またはヘッダ既定値)から、`tool` は `app.name ?? app.exe` から。`options.responsibility` は company / department / section / team など上位軸の固定値を与える。
   - `status`: `"discovered"`。
4. **フロー合成**: 隣接するセグメント i → i+1 に 1 本ずつ `FlowDef` を張る。結果は常に単純パスであり、**構成上サイクルは生じない**(コアはサイクルを拒否するため、往復 A→B→A をエッジ集約せず出現単位で展開するのは意図的な設計である)。
5. **文書化**: `schemaVersion: "responsible.v0"` のフラットな `ProcessModel` として返す。ルート Activity は付与しない — 読み込み経路の `ensureRootActivity` が合成ルートで包む既存挙動に任せる。`views` も付与しない(境界ズームは viewer 側の状態である)。

畳み込みはモデル側では行わない。`tool` ズームでは出現単位の細かいパスが見え、`person` に粗くすると同一担当者の連続出現が RBNF で 1 ノードに畳まれる。往復や散らかりの整理は射影の仕事であり、発見の仕事ではない。

## プライバシー原則(規範)

操作記録は監視ツールに転用され得るため、記録スクリプトと文書は次を必須とする:

1. **メタデータのみ**: 記録するのはアプリの実行ファイル名・表示名、ウィンドウタイトル、時刻のみ。キーストローク、画面内容、クリップボード、URL のクエリ等の入力内容は記録しない。
2. **本人の同意と自己利用**: 記録は記録される本人が自分の業務フローを発見するために自分で開始・停止する。第三者の PC での無断記録を支援する機能(隠蔽起動、リモート収集、自動アップロード)は実装しない。
3. **マスキング**: ウィンドウタイトルには顧客名等が含まれ得る。記録スクリプトは正規表現によるタイトルマスキング(`[masked]` への置換)をオプションとして備え、README で明示する。
4. **ローカル完結**: 出力はローカルの JSONL ファイルのみ。ネットワーク送信は行わない。

## 段階的計画

| Stage | スコープ                                                                        | Issue                                                    |
| ----- | ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1     | `tool` 境界レベル(hierarchy / viewer ラベル / サンプル / docs / テスト)         | `issues/open/20260707-add-tool-boundary-level.md`        |
| 2     | `responsible.oplog.v0` パーサ、`discoverProcessModel`、CLI、example、テスト     | `issues/open/20260707-define-oplog-and-discovery.md`     |
| 3     | Windows 操作記録スクリプト(`tools/recorder-win/`)、マスキング、README、検証手順 | `issues/open/20260707-add-windows-operation-recorder.md` |

Stage 1 と Stage 2 は独立に出荷可能である(Stage 2 の受け入れ確認には Stage 1 の `tool` ズームがあることが望ましい)。Stage 3 は Stage 2 のログ形式に依存する。

## 表明可能な部分集合

Stage 2 完了後、テストは次を表明できなければならない:

- ログのパースと行番号付きエラー報告。
- セグメント化規則(併合・gap / idle での打ち切り)とタイトル正規化。
- 往復を含むログから合成したモデルが `validateProcessModel` を通過し、射影がサイクルエラーにならないこと。
- `responsibility` の合成(固定軸 + `person` + `tool`)と `status: "discovered"`。
- `tool` 境界での射影は出現単位のパスを保ち、`person` 境界への RBNF で同一担当者の連続出現が畳み込まれること。
