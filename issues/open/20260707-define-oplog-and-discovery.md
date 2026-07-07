# 操作ログ形式 `responsible.oplog.v0` と発見コンバータを実装する(Stage 2)

Status: open
Model: Claude
Created: 2026-07-07
Updated: 2026-07-07

## 概要

`docs/workflow-discovery.md` の Stage 2 として、操作ログ(JSONL)のパーサと、ログから `status: "discovered"` の Activity 列を合成する純関数 `discoverProcessModel`、およびファイル変換 CLI を実装する。ログスキーマ・発見規則・検証項目の規範は `docs/workflow-discovery.md` の「操作ログ形式」「発見規則」節であり、本 issue はその実装指示である。

## 背景

- 実務レベルの業務フローは手書きでは作成コストが高い。フォアグラウンドウィンドウの遷移ログ(誰が・どのアプリで・どのウィンドウを・いつ)から `ProcessModel` を機械的に合成できれば、`discovered` 状態の叩き台が得られ、人はそれを `defined` に引き上げる作業に集中できる。
- コアは循環を拒否する(`src/quotient.ts`、README「cycles are rejected」)。往復 A→B→A をエッジ集約するとサイクルになるため、規範文書は「出現(occurrence)単位の線形パス」として合成すると決定済み。畳み込みは境界ズーム + RBNF(Stage 1 の `tool` レベル)が担う。
- 既存の再利用可能部品: `validateProcessModel` / `parseProcessModelJson`(`src/validate.ts`)、`ensureRootActivity`(フラットモデルの合成ルートラップ、読み込み経路で自動適用)、`ActivityStatus` の `"discovered"`(`src/model.ts`)。

## 問題

- 操作ログの形式が定義されておらず、記録(Stage 3)と変換の間に契約がない。
- ログから responsible 形式へ変換する手段がない。

## 目標

- `responsible.oplog.v0` の JSONL をパース・検証し、`discoverProcessModel` で `validateProcessModel` を通過するモデルへ決定的に変換でき、CLI で「記録 → 変換 → viewer で閲覧」が成立する状態。

## 対象外

- Windows 記録スクリプト(Stage 3)。本 issue では `examples/` の手書きログで代替する。
- プロセスマイニング(頻度分析・分岐推定・複数トレースのマージ・往復の集約)。1 ログ = 1 線形パス。
- `note` エントリの活用(v0 では無視。将来の拡張のため予約)。
- viewer の変更(Stage 1 の `tool` ズームがそのまま使える)。

## 提案する方針

1. `src/discover/oplog.ts` を新設する(依存ゼロ):
   - 型: `OpLogEntry`(`header` / `focus` / `idle` / `resume` / `note` の判別 union)。フィールドは `docs/workflow-discovery.md` の型定義に一致させる。
   - `parseOperationLogJsonl(text: string): { ok: true; entries: OpLogEntry[] } | { ok: false; issues: OpLogIssue[] }`。`OpLogIssue` は `{ line: number; message: string }`(1 始まり行番号)。検証項目は規範文書の「検証」節のとおり: 不正 JSON / 非オブジェクト行、未知 `kind`、必須フィールドの欠落・空文字列(`t`、`focus` の `app.exe` / `window.title`、ヘッダ既定値がない場合の `person`)、RFC 3339 として不正な `t`(`Date.parse` で NaN になるものを拒否)、先頭行以外の `header`、`schemaVersion` 不一致。空行は無視する。
2. `src/discover/discover.ts` を新設する(依存ゼロ・純関数):
   - `discoverProcessModel(entries: readonly OpLogEntry[], options?: DiscoverOptions): ProcessModel`。
   - `DiscoverOptions = { responsibility?: Responsibility; titleRules?: readonly { pattern: string; replace: string }[]; gapMinutes?: number }`(既定: `responsibility` なし、`titleRules` なし、`gapMinutes: 15`)。
   - 発見規則は規範文書の 5 項目に厳密に従う: `t` で安定ソート → タイトル正規化(`new RegExp(pattern, "u")` を順に適用)→ セグメント化(キー `(app.exe, 正規化タイトル)` の連続併合、gap 超過または `idle` 介在で打ち切り)→ Activity 合成(`id` は `op-001` 形式、`name` は正規化タイトル(空なら `app.name ?? app.exe`)、`input`/`output` は `"Unknown"`、`responsibility` は `{ ...options.responsibility, person, tool: app.name ?? app.exe }`、`status: "discovered"`)→ 隣接フローのみの `flows`。
   - 返り値はフラットな `responsible.v0` 文書: `types` に `Unknown: { kind: "primitive" }` を含め、ルート Activity・`views` は付与しない(読み込み経路の `ensureRootActivity` に任せる)。
   - `person` はエントリの `person` またはヘッダ既定値。どちらもない場合はパーサが拒否済みなので考慮不要。
3. `src/index.ts` から `parseOperationLogJsonl` / `discoverProcessModel` と関連型を re-export する。
4. CLI `tools/oplog-to-model.mjs` を新設する(node 単体、依存ゼロ、`node:util` の `parseArgs` を使用):
   - `node tools/oplog-to-model.mjs <input.jsonl> [-o model.json] [--responsibility key=value]... [--title-rule pattern=replace]... [--gap-minutes N]`
   - `-o` 省略時は stdout。パース失敗時は行番号付きで stderr に出力し exit 1。生成後に `validateProcessModel` を通し、万一失敗したら issues を出力して exit 1(自己検証)。
   - dist ではなく `src/` の TS を直接 import できないため、`tools/test-register.mjs` と同様の仕組みがあるか確認し、なければ CLI 内で `node --experimental-strip-types` 前提にするか、`tools/test-register.mjs` の register を流用して TS を import する(既存テストランナーの方式に合わせること)。
5. `examples/oplog-sample.jsonl` を追加する: ヘッダ + 10〜15 行程度の `focus`(Outlook / Excel / ブラウザ等の現実的な往復を含む)+ `idle`/`resume` を 1 組。`docs/workflow-discovery.md` の例と整合させる。変換結果の例 `examples/oplog-sample.discovered.json` も生成してコミットし、README から参照する。
6. README(日英)の「Using the viewer」または適切な節に、「操作ログからの発見」1 段落(CLI の使い方と `docs/workflow-discovery.md` へのリンク)を追加する。

## 受け入れ条件

- [ ] `examples/oplog-sample.jsonl` が `parseOperationLogJsonl` でパースでき、壊れた行(不正 JSON、`t` 欠落など)が 1 始まりの行番号付きで報告される。
- [ ] `discoverProcessModel` の出力が `validateProcessModel` を通過し、往復(A→B→A)を含むログでも射影(`projectDagByResponsibilityBoundary`)がサイクルエラーにならない。
- [ ] 連続する同一 `(app.exe, 正規化タイトル)` の `focus` が 1 Activity に併合され、`gapMinutes` 超過・`idle` 介在で出現が分割される。
- [ ] 出力 Activity が `status: "discovered"` と `responsibility`(固定軸 + `person` + `tool`)を持ち、`flows` が隣接ペアのみの単純パスである。
- [ ] CLI で `examples/oplog-sample.jsonl` を変換した JSON が viewer の「JSON を読み込む」で読み込め、`tool` ズームで出現単位のパスが、`person` ズームで畳み込まれたビューが表示される(手動確認、`.claude/skills/verify` があれば利用)。
- [ ] `pnpm run check && pnpm run typecheck && pnpm test && pnpm run build` が通る。

## テスト計画

`src/__tests__/discover.test.ts`(node:test)を新設:

- パース: 正常系(ヘッダ既定値の適用)、不正 JSON 行・必須フィールド欠落・2 行目の `header`・不正 `t` の行番号付き報告、空行の無視。
- セグメント化: 同一キー連続の併合、タイトル正規化によるキー一致(`titleRules` 適用)、`gapMinutes` 超過での分割、`idle` 介在での分割。
- モデル合成: 往復ログ → 出現単位の 3 Activity + 2 flows(サイクルなし)、`validateProcessModel` 通過、`responsibility` 合成(`options.responsibility` に company 等を与えたケース)、`Unknown` 型の存在。
- 射影との結合: 合成モデルを境界 `tool` と `person` へ射影し、`tool` ではパスが保たれ、`person` では同一担当者の連続出現が 1 composite に畳まれること(RBNF)。

## リスク

- CLI から TS コアを import する方式がリポジトリ慣習として未確立(既存 `tools/test-register.mjs` はテスト用)。ビルド成果物への依存を避けるため register 流用を第一候補とし、うまくいかない場合は CLI のみ `.mjs` 内にパーサ/コンバータを再実装せず、`pnpm` script(例: `pnpm run discover`)として vite/tsx なしで動く方法を検討する。コアの依存ゼロ方針は崩さないこと。
- ウィンドウタイトルの多様性により正規化既定(無変換)ではセグメントが細かくなりすぎる可能性があるが、v0 では `titleRules` オプションで対処し、既定は規範文書どおり無変換とする。

## 変更履歴

`CHANGES.md` impact: yes

項目案:

- Define the `responsible.oplog.v0` operation-log format and implement workflow discovery: `parseOperationLogJsonl`, `discoverProcessModel` (occurrence-path synthesis, always cycle-free), and the `tools/oplog-to-model.mjs` CLI. (`issues/open/20260707-define-oplog-and-discovery.md`)

## 注記

- 規範文書は `docs/workflow-discovery.md`(日英ペア)。スキーマ・発見規則を変更する場合は文書側を先に改訂すること。
- Stage 1(`issues/open/20260707-add-tool-boundary-level.md`)の `tool` ズームがあると受け入れ確認が容易になるが、本 issue 自体は Stage 1 なしでも実装・テスト可能(射影 API は任意の境界キーを受け付ける)。
