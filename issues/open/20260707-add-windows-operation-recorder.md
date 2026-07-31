# Windows 操作記録スクリプトを追加する（Stage 3）

Status: open
Model: Claude
Created: 2026-07-07
Updated: 2026-07-31

## 概要

[`docs/workflow-discovery.md`](../../docs/workflow-discovery.md) の Stage 3 として、Windows のフォアグラウンドウィンドウ遷移を `responsible.oplog.v0` JSONL として記録する PowerShell スクリプトを追加する。

記録される本人が自分の業務フロー発見のために開始・停止する、ローカル完結のツールとする。

## 実装

### ファイル

- `tools/recorder-win/Record-Operations.ps1`
- `tools/recorder-win/test-format.ps1`
- `tools/recorder-win/README.md`

### パラメータ

- `-OutFile <path>`
- `-Person <string>`
- `-IntervalMs <int>`（既定1000）
- `-IdleSeconds <int>`（既定300、0で無効）
- `-TitleMaskPatterns <string[]>`

### Win32 API

- `GetForegroundWindow`
- `GetWindowTextW` / `GetWindowTextLengthW`
- `GetWindowThreadProcessId`
- `GetLastInputInfo`

プロセス情報取得の権限不足は例外処理し、`exe` は必ず空でない値へフォールバックする。

## `window.title` の必須フォールバック

`responsible.oplog.v0` は空の `focus.window.title` を拒否する。`GetWindowTextW` が失敗した場合や空文字列を返した場合、記録側で次の順に空でない値へフォールバックする。

1. 取得済みの `app.name`。
2. `app.exe`。

`title: ""` を書き込んではならない。タイトル取得失敗をパーサや発見コンバータへ押し付けない。

マスキングはフォールバック決定後、ファイル書き込み前に適用する。マスキング結果も空にしてはならず、全体を隠す場合は `[masked]` を残す。

## 時刻

`t` と `header.startedAt` は `YYYY-MM-DDTHH:mm:ss[.fraction](Z|±HH:mm)` の明示オフセット付き形式で出力する。Stage 2 の厳格な RFC 3339 検証を通ることを形式テストで確認する。

## 動作

1. 起動時に `header` を1行書く。
2. `(exe, マスク済み title)` が変化したときだけ `focus` を書く。
3. アイドル開始時に `idle`、入力再開時に `resume` をそれぞれ1回書く。
4. Ctrl+C で終了する。
5. 出力はローカルファイルだけとし、ネットワーク通信を行わない。

## プライバシー要件

- キー入力、画面内容、クリップボード、URL内容を取得しない。
- 記録される本人が開始・停止する。
- 隠蔽起動、自動起動、リモート収集、自動アップロードを実装しない。
- 生タイトルを保存する前にマスキングする。
- README に記録対象と非記録対象を明記する。

## 受け入れ条件

- [ ] Windows PowerShell 5.1 または pwsh 7 で動作する。
- [ ] `header`、`focus`、`idle`、`resume` が仕様どおり出力される。
- [ ] タイトル取得失敗時も `window.title` が空にならない。
- [ ] `app.name` があればそれを、なければ `app.exe` をタイトルのフォールバックに使う。
- [ ] マスキング後の生タイトルがファイルへ残らない。
- [ ] 出力時刻が Stage 2 の厳格な RFC 3339 検証を通る。
- [ ] 出力JSONLを `parseOperationLogJsonl` が issues なしで受理する。
- [ ] Stage 2 CLI で変換し、viewerへ読み込める。
- [ ] `test-format.ps1` が pwsh 7 で成功する。
- [ ] リポジトリの全品質ゲートが通る。

## 形式テスト

`test-format.ps1` で Win32 呼び出し以外の純粋部を検証する。

- JSONL 1行として再パースできる。
- タイトルマスキング。
- 同一 focus の重複抑制。
- タイトル変更の検出。
- タイトル取得失敗時の `app.name` フォールバック。
- `app.name` もない場合の `app.exe` フォールバック。
- 空タイトルが一切生成されない。
- 出力時刻がオフセット付き RFC 3339 形式である。

## 対象外

- 常駐アプリ、インストーラ、自動起動。
- リモート収集、自動アップロード。
- macOS / Linux 版。
- ブラウザ拡張によるタブ・URL取得。
