# Windows 操作記録スクリプトを追加する(Stage 3)

Status: open
Model: Claude
Created: 2026-07-07
Updated: 2026-07-07

## 概要

`docs/workflow-discovery.md` の Stage 3 として、Windows 上でフォアグラウンドウィンドウの切替を `responsible.oplog.v0`(JSONL)として記録する PowerShell スクリプト `tools/recorder-win/Record-Operations.ps1` を追加する。記録 → 変換(Stage 2 の CLI)→ viewer 閲覧のパイプラインを README で成立させる。

## 背景

- ログ形式と発見規則は `docs/workflow-discovery.md` が規範として定義済みで、変換側は Stage 2(`issues/open/20260707-define-oplog-and-discovery.md`)が実装する。残るのは記録側である。
- v0 はビルドツールチェーン不要・単一ファイルで監査可能な PowerShell スクリプトとする。Windows PowerShell 5.1(Windows 標準)と pwsh 7 の両方で動くこと。C#/.NET の常駐(タスクトレイ)アプリ化は将来課題。
- プライバシー原則(`docs/workflow-discovery.md` の「プライバシー原則」節)は規範であり、本 issue の実装・文書の必須要件である: メタデータのみ、本人の同意と自己利用、タイトルマスキング、ローカル完結。

## 問題

- 実務者が自分の操作を `responsible.oplog.v0` として記録する手段がなく、Stage 2 の発見コンバータに入力する現実のログを得られない。

## 目標

- 実務者が自分の Windows PC でスクリプトを実行し、Ctrl+C で停止するまでのフォアグラウンドウィンドウ遷移が oplog JSONL として保存され、そのまま Stage 2 の CLI に入力できる状態。

## 対象外

- 常駐/タスクトレイアプリ、インストーラ、自動起動、リモート収集・自動アップロード(プライバシー原則により実装しない)。
- キーストローク・画面内容・クリップボード・URL 内容の記録(同上)。
- macOS / Linux 向け記録スクリプト。
- CI での Windows 実行(検証は手動テスト計画と、pwsh で動く純粋部のユニット検証スクリプトで行う)。

## 提案する方針

1. `tools/recorder-win/Record-Operations.ps1` を新設する。パラメータ:
   - `-OutFile <path>`(既定: `operations-<yyyyMMdd-HHmmss>.jsonl`。既存ファイルには追記)
   - `-Person <string>`(既定: `$env:USERNAME`)
   - `-IntervalMs <int>`(既定: 1000。ポーリング間隔)
   - `-IdleSeconds <int>`(既定: 300。これを超える無入力で `idle`、入力再開で `resume` を出力。0 で無効)
   - `-TitleMaskPatterns <string[]>`(正規表現の配列。ウィンドウタイトル中のマッチ部分を `[masked]` に置換してから出力)
2. Win32 API は `Add-Type` の P/Invoke で宣言する: `GetForegroundWindow`、`GetWindowTextW`(+ `GetWindowTextLengthW`)、`GetWindowThreadProcessId`、`GetLastInputInfo`。プロセス名は `Get-Process -Id` の `ProcessName`(+`.exe` 補完)と `MainModule.FileVersionInfo.FileDescription`(取得できれば `app.name`、アクセス拒否時は省略)から得る。
3. 動作: 起動時に `header` 行(`schemaVersion` / `person` / `machine: $env:COMPUTERNAME`)を書き、以後ポーリングで `(exe, マスク後タイトル)` が直前と変化したときだけ `focus` 行を追記する。`t` は `Get-Date -Format o` 相当のオフセット付き RFC 3339。Ctrl+C(`finally`)で後処理して終了する。コンソールには記録先と直近イベントの簡潔な表示のみ行う。
4. 純粋部を関数に分離する: `Protect-Title`(マスキング)、`ConvertTo-OpLogLine`(エントリ → JSON 1 行。`ConvertTo-Json -Compress -Depth 5`)、`Test-FocusChanged`(変化判定)。Win32 呼び出し部と分離し、下記の検証スクリプトから dot-source で読み込めるようにする(`param` ブロックとポーリングループは `if ($MyInvocation.InvocationName -ne '.')` 等でガードするか、関数定義を別ファイル `OpLog.psm1` に切り出す — 実装しやすい方でよいが、検証スクリプトが Linux の pwsh で動くこと)。
5. `tools/recorder-win/test-format.ps1` を新設する: 純粋部のみを読み込み、(a) マスキングが `[masked]` 置換になること、(b) 出力行が JSON としてパースでき必須フィールドを持つこと、(c) 変化判定(同一 → 出力なし、タイトルのみ変化 → 出力あり)を assert する。Linux/macOS の pwsh 7 でも実行できることを確認する(CI には組み込まない)。
6. `tools/recorder-win/README.md` を新設する(日本語でよい)。必須内容:
   - 使い方(実行例、停止方法、出力ファイル)と実行ポリシー(`powershell -ExecutionPolicy Bypass -File ...` の注意)。
   - **記録される情報の明示**(アプリ実行ファイル名・表示名、ウィンドウタイトル、時刻のみ。キーストローク・画面内容・クリップボードは記録しない)。
   - **同意と自己利用の原則**(自分の業務フロー発見のために本人が実行する。他者の PC での無断記録に使わない)。
   - `-TitleMaskPatterns` の使用例(顧客名・案件番号のマスク)。
   - パイプライン手順: 記録 → `node tools/oplog-to-model.mjs operations-*.jsonl -o discovered.json` → viewer の「JSON を読み込む」→ `tool` / `person` ズームで確認。
   - 出力はローカルファイルのみでネットワーク送信しないこと。
7. ルート README(日英)の適切な節(Stage 2 で追加する「操作ログからの発見」段落)に、記録スクリプトへの 1 文とリンクを追加する。

## 受け入れ条件

- [ ] Windows(PowerShell 5.1 または pwsh 7)で実行すると `header` 行に続き、ウィンドウ切替のたびに `focus` 行が追記され、Ctrl+C で正常終了する(手動確認)。
- [ ] 出力 JSONL が Stage 2 の `parseOperationLogJsonl` を issues ゼロで通過し、`tools/oplog-to-model.mjs` で変換したモデルが viewer で表示できる(手動確認)。
- [ ] `-TitleMaskPatterns` 指定時、マッチ部分が `[masked]` に置換されたタイトルだけがファイルに書かれる(生タイトルはどこにも残らない)。
- [ ] `-IdleSeconds` 超過で `idle`、入力再開で `resume` が 1 回ずつ出力される。
- [ ] `tools/recorder-win/test-format.ps1` が Linux の pwsh 7 で成功する。
- [ ] README にプライバシー原則(記録範囲・同意・マスキング・ローカル完結)が明記されている。
- [ ] リポジトリの品質ゲート `pnpm run check && pnpm run typecheck && pnpm test && pnpm run build` が引き続き通る(本 issue は TS コードに触れないが確認する)。

## テスト計画

- 自動(クロスプラットフォーム): `test-format.ps1` による純粋部(マスキング・JSON 整形・変化判定)の assert。
- 手動(Windows): (1) メモ帳 → ブラウザ → Excel と切り替えて `focus` 3 行が記録されること、(2) 同一ウィンドウ内での作業では行が増えないこと、(3) `-TitleMaskPatterns "顧客\\w+"` で該当部分がマスクされること、(4) 5 分放置 → 再開で `idle`/`resume` が出ること、(5) 出力を Stage 2 CLI → viewer に通すこと。手順と結果を issue のコメント(注記追記)に残す。

## リスク

- `GetWindowTextW` は UWP アプリや管理者権限ウィンドウでタイトルを取得できないことがある。取得失敗時は `title: ""` として記録し、発見側の `name` フォールバック(`app.name ?? app.exe`)に任せる。
- `Get-Process` の `MainModule` は権限不足で例外を投げ得る。`try/catch` で `app.name` を省略し、`exe` は `ProcessName + ".exe"` で埋める。
- ポーリング(既定 1 秒)は短時間のウィンドウ切替を取りこぼし得るが、業務フロー発見の粒度では許容する(README に明記)。
- PowerShell 5.1 と pwsh 7 の `ConvertTo-Json` の挙動差(エスケープ・Depth)に注意。テストスクリプトで出力行の再パースを assert して吸収する。

## 変更履歴

`CHANGES.md` impact: yes

項目案:

- Add a Windows operation recorder script (`tools/recorder-win/`) that logs foreground-window switches as `responsible.oplog.v0` with title masking, completing the record → discover → view pipeline. (`issues/open/20260707-add-windows-operation-recorder.md`)

## 注記

- 規範文書は `docs/workflow-discovery.md`(日英ペア)。特に「プライバシー原則」節は本 issue の必須要件である。
- 本 issue は Stage 2(`issues/open/20260707-define-oplog-and-discovery.md`)のログ形式に依存する。Stage 2 完了前に着手する場合も、形式は規範文書に固定されているため記録側の実装は可能。
- 将来課題: C#/.NET によるタスクトレイ常駐版、ブラウザタブ単位の記録(拡張機能)、macOS 版。いずれも別 issue とする。
