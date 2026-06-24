# reference implementation を semantic-core v0 の意味論へ整合させる

Status: polished
Model: claude-opus-4-8
Created: 2026-06-24
Updated: 2026-06-24
Branch: feat/4-align-reference-impl-semantic-core
Source:

- https://github.com/f4ah6o/responsible/issues/4

## 概要

`docs/semantic-core.md` を正典として、TypeScript の reference implementation に意味論語彙の additive な型レイヤと plain data の `Effect` モデル、不変条件 `INV-1`〜`INV-6` の表明ヘルパとテストを追加する。v0 の「表明可能な部分集合」に限定し、将来の `World` / `ActivityResult` 実行 API は導入しない。

## 背景

- `docs/semantic-core.md` が semantic core の規範文書である。同文書 5 行目は重要な制約を定める。`World`、`ActivityResult`、`Effect`、`BoundaryProjection` を含む TypeScript スニペットは「将来の意味論ターゲット」であり、現行 v0 の `src/model.ts` が export する API ではない。
- 現行の reference implementation は次の薄いモジュール構成で、`ProcessModel -> ProcessView` の純粋射影を中心とする(`docs/reference-implementation.md` の Layering 節)。
  - `src/model.ts`: データ型のみ。`ActivityDef`(`input`/`output`/`responsibility`/`children`)、`ProcessModel`、`ProcessView`、`ProjectedActivity`(`atomic` | `composite`)。
  - `src/boundary.ts`: `boundaryOf(activity, boundaryExpr) -> string`、`resolveBoundaryValue`、`formatBoundaryValue`。
  - `src/normalize.ts`: `projectByResponsibilityBoundary(model, view)`、`isResponsibilityBoundaryNormalForm(view)`、内部の `linearOrder`(branching/merging/cycle/multiple-start/disconnected を `throw` で拒否)、`composeRun`(同一 boundary 連続を composite へ畳み込む)。
  - `src/graph.ts`: 依存物なしの SVG レイアウト(可視化、モデルの下流)。
  - `src/index.ts`: `model` / `boundary` / `normalize` / `graph` を再 export。
- 現在テストランナーは未導入(`package.json` に `test` script なし)。関連する未着手 Issue `issues/open/20260624-add-reference-implementation-tests.md` が `node:test` ベースのランナー導入と boundary/projection/linear 制約のテストを担当する。本 Issue はそのランナー方針(`node:test` / `node:assert`、コアにランタイム依存を増やさない)を共有し、重複したランナーを新設しない。
- v0 は linear flow のみ対応で、branching / merging / cycle / disconnected を意図的に拒否する(`docs/reference-implementation.md` の v0 limitation 節、`src/normalize.ts:131-189`)。

## 問題

reference implementation が semantic core の語彙と不変条件をコードとして表明していない。具体的には次が検証できない。

- 同一 Responsibility Boundary 内の Activity 合成が Activity(v0 では `ProjectedActivity`)を返し、合成可能性を保つこと(`INV-6`)。
- mutation・ensures・effects の区別。特に boundary を跨いで観測可能になる `Effect` が値として表現され、directed effect の source / target boundary が既知であること(`INV-3`)。
- `projectByResponsibilityBoundary` が read-only で、`ProcessModel` を変更しないこと(`INV-1`、`INV-2`)。
- 射影が選択スコープ内の leaf Activity から行われること(`INV-4`)。
- RBNF collapse が不可逆で、復元 API を提供しないこと(`INV-5`)。

加えて、公開コア API が `docs/semantic-core.md` の意味論語(`BoundaryId`、`ActivityId`、`Projection`、`RBNF`、`Effect` など)で語られていない。

## 目標

reference implementation を semantic core に整合させ、次の最終状態にする。

- 公開コア API が意味論語彙(`BoundaryId`、`ActivityId`、`SchemaRef`、`Projection`、`RBNF`、`Effect`、opaque な `requires` / `ensures` 参照)を additive に提供する。
- plain で JSON シリアライズ可能な `Effect` データ型が存在し、directed effect の boundary 整合を検証できる。
- `INV-1`〜`INV-6` が、実行可能なテストまたは表明ヘルパで検証される。
- v0 の linear-only 制限と「復元 API なし」が、テストで明示的に守られる。
- README / docs が、現行 v0 は semantic core の表明可能な部分集合のみを実装する旨を説明する。
- コアのランタイム依存はゼロのまま。

## 対象外

正典 `docs/semantic-core.md` 5 行目および GitHub Issue #4 の Non-goals に従い、次を本 Issue で扱わない。

- 将来の実行 API を主たる公開 API として実装すること。具体的には関数形 `Activity<I,O> = (world, input) => ActivityResult`、`World`、`ActivityResult`、`seq` の Kleisli 合成、`Requires` / `Ensures` の述語「実行」(runtime contract checking)。v0 では `requires` / `ensures` は opaque な参照(文字列等)の型語彙のみとし、評価・連鎖検証は導入しない。
- 既存 export(`projectByResponsibilityBoundary`、`ProcessView`、`ProjectedActivity`、`boundaryOf` 等)の rename / 削除による破壊的変更。本 Issue の再構成は additive(意味論語彙レイヤの追加と再 export)に限る。破壊的な命名整理は将来の別 Issue とする。
- `Effect` を `ProcessModel` / `ActivityDef` スキーマへ埋め込むこと(`schemaVersion: "responsible.v0"` の変更)。v0 では `Effect` は standalone のデータ型 + 検証ヘルパとして扱い、モデルスキーマは現状維持する。
- 静的な Hoare 流証明(`ensures_A => requires_B` の静的証明)、symbolic predicate AST / DSL。
- branching / merging / parallel / cycle / disconnected の graph quotient projection、一般の weak bisimulation minimization。
- React、graph layout ライブラリ、parser generator、schema validator、persistence、server framework 依存の導入。
- 可視化(`src/graph.ts` 等)の再設計。可視化はモデルの下流のまま維持する。

## 提案する方針

### 1. 意味論語彙レイヤを追加する(additive)

新規 `src/semantic.ts` を追加し、既存型へ別名・薄いラッパを与える。既存 export は維持する。

- `export type ActivityId = Id;`
- `export type BoundaryId = string;`(`boundaryOf` の戻り値型に一致)
- `export type SchemaRef = string;`(opaque、`TypeRef` と同様)
- `export type Projection = "responsibilityBoundary";`(`ViewDef.normalForm` に対応)
- `export type RBNF = ProcessView;`(RBNF view の別名)
- `export type RequiresRef = string;` / `export type EnsuresRef = string;`(opaque な述語参照。v0 では評価しない)

`src/index.ts` から `src/semantic.ts` を再 export し、公開 API が意味論語で語られる状態にする。

### 2. plain data の `Effect` 型を追加する

`docs/semantic-core.md` の Effect model 節に一致する JSON シリアライズ可能な値型を `src/semantic.ts`(または `src/effect.ts`)へ追加する。実行時の side effect ではなく値である。

```ts
export type Effect = Readonly<{
  source: Readonly<{ activityId: ActivityId; boundary: BoundaryId }>;
  payload:
    | Readonly<{ kind: "domain-fact"; schema: SchemaRef }>
    | Readonly<{ kind: "command"; schema: SchemaRef }>
    | Readonly<{ kind: "data"; schema: SchemaRef }>;
  delivery:
    | Readonly<{ mode: "directed"; target: BoundaryId }>
    | Readonly<{ mode: "broadcast" }>
    | Readonly<{ mode: "observable" }>;
}>;
```

`Effect` は実装ローカルな mutation を意味しない。mutation は将来の Activity 実行内部の概念であり、本コアには mutation 用 API を設けない(`INV-2` の v0 表明)。

### 3. `Effect` boundary 整合の検証ヘルパを追加する(INV-3)

standalone の検証関数を追加する。既知 boundary 集合はモデルから導出する。

- `export function knownBoundaryIds(model: ProcessModel, boundary: BoundaryExpr): ReadonlySet<BoundaryId>`
  - `model.activities` の各 leaf を `boundaryOf(activity, boundary)` で射影した値の集合を返す。
- `export function validateDirectedEffect(model: ProcessModel, boundary: BoundaryExpr, effect: Effect): { ok: true } | { ok: false; reason: string }`
  - `effect.source.activityId` が `model.activities` に存在すること。
  - `effect.source.boundary` が `knownBoundaryIds(...)` に含まれること。
  - `effect.delivery.mode === "directed"` のとき `effect.delivery.target` が `knownBoundaryIds(...)` に含まれること。
  - いずれか不成立なら `{ ok: false, reason }`。

### 4. leaf スコープ射影を表明する(INV-4)

- `export function leafActivityIds(model: ProcessModel, scopeId?: Id): readonly Id[]`
  - `children` を持たない Activity(leaf)を、`scopeId` 指定時はそのスコープ配下に限定して返す。`scopeId` 省略時はモデル全体の leaf。
- `projectByResponsibilityBoundary` が射影する source activity の集合が `leafActivityIds(...)` の部分集合であることを表明するテストを追加する。実装変更が必要な場合も、非 leaf(`children` を持つ親)を直接射影しないことを保証する範囲に限定する。

### 5. 射影の read-only 性を表明する(INV-1 / INV-2)

`projectByResponsibilityBoundary` は現状すでに新しい `ProcessView` を構築して返し、入力を変更しない。これを表明するため、入力モデルの deep clone(`structuredClone`)を射影前に取り、射影後に元モデルと `deepStrictEqual` で一致することを確認するテストを追加する。コアに mutation 用 API が存在しないことを `INV-2` の v0 表明としてテストとドキュメントで担保する。

### 6. RBNF 不可逆・復元 API 不在を表明する(INV-5)

- 復元 / 逆射影 API を追加しない。
- `import * as api from "../src/index.js"` で公開 export 名を列挙し、`/restore|inverse|unproject|reverse|deproject|expand/i` に一致する export が存在しないことを表明するテストを追加する。

### 7. 合成が Activity を返すことを表明する(INV-6)

公開 `projectByResponsibilityBoundary` を通じて、同一 boundary 連続が `kind: "composite"` の `ProjectedActivity` に畳み込まれ、`activityIds` が子の順序を保ち、`input` が先頭・`output` が末尾に一致することを表明するテストを追加する(`src/normalize.ts:79-106` の `composeRun` の挙動)。

### 8. v0 linear-only 拒否を表明する(既存挙動)

`linearOrder` が branching / merging / cycle / multiple-start / disconnected を拒否することを、`docs` 記載のエラーメッセージに対するテストで表明する(`src/normalize.ts:157-186`)。

### 9. テストランナーとスクリプト

- `node:test` / `node:assert` を使用し、コアのランタイム依存を増やさない。
- `package.json` に `test` script を追加する。TypeScript は Node 標準の型ストリップ(`node --test`、対応バージョン)で実行するか、`add-reference-implementation-tests` が確立するランナー方針に従う。同 Issue が先行マージ済みなら、そのランナーを再利用し新設しない。
- テストは `src/__tests__/` または `tests/` に集約し、可能な限り `src/index.ts` 経由の公開 API を import する。

### 10. ドキュメント更新

- `README.md`(Theoretical position 節)または `docs/reference-implementation.md`(v0 limitation 節)に、現行 v0 は semantic core の表明可能な部分集合(`INV-1`〜`INV-6`、linear-only、`Effect` は plain data、実行 API なし、逆射影 API なし)のみを実装する旨を追記する。

## 受け入れ条件

- [ ] Given `src/index.ts` の公開 export、when それを列挙する、then `BoundaryId`、`ActivityId`、`SchemaRef`、`Projection`、`RBNF`、`Effect` を含む意味論語彙が export されている。
- [ ] Given 既存 export(`projectByResponsibilityBoundary`、`ProcessView`、`ProjectedActivity`、`boundaryOf`)、when 本変更後に参照する、then いずれも rename / 削除されず利用可能である。
- [ ] Given core パッケージ、when `package.json` と import を確認する、then コアのランタイム依存は 0 のままである(`node:*` と `devDependencies` のみ)。
- [ ] Given 任意の linear `ProcessModel`、when `projectByResponsibilityBoundary(model, view)` を実行する、then 実行前後で `model` が `deepStrictEqual` に等価である(`INV-1`)。
- [ ] Given source.activityId と source.boundary が既知で directed target も既知の `Effect`、when `validateDirectedEffect` を実行する、then `{ ok: true }` を返す。
- [ ] Given source.boundary または directed target が未知、あるいは source.activityId が未知の `Effect`、when `validateDirectedEffect` を実行する、then `{ ok: false, reason }` を返す(`INV-3`)。
- [ ] Given 親(`children` を持つ)を含むモデル、when 射影する、then 射影される source activity は `leafActivityIds(...)` の部分集合である(`INV-4`)。
- [ ] Given 同一 boundary が連続する linear flow、when 射影する、then `kind: "composite"` のノードが生成され `activityIds` が子の順序を保ち、`input` が先頭・`output` が末尾に一致する(`INV-6`)。
- [ ] Given branching / merging / cycle / multiple-start / disconnected を含むモデル、when 射影する、then `docs` 記載のメッセージで `throw` する。
- [ ] Given 公開 export、when 名前を走査する、then `restore` / `inverse` / `unproject` / `reverse` / `deproject` / `expand` 系の逆射影・復元 API が存在しない(`INV-5`)。
- [ ] Given 出力 `ProcessView`、when `isResponsibilityBoundaryNormalForm` を実行する、then 同一 boundary の隣接が無く `true` を返す。
- [ ] Given README または docs、when v0 範囲の記述を確認する、then 「v0 は表明可能な部分集合のみ実装」が明記されている。

## テスト計画

- 単体テスト(`node:test` / `node:assert`):
  - `INV-1`: `structuredClone` で取得した入力コピーと射影後の `model` を `deepStrictEqual` で比較。
  - `INV-3`: `validateDirectedEffect` の成功・失敗(未知 source.boundary、未知 directed target、未知 activityId)各ケース。
  - `INV-4`: 親 + leaf を含むモデルで、射影 source が leaf 集合の部分集合であること。
  - `INV-6`: 同一 boundary 連続が composite に畳み込まれ `activityIds` 順序と input/output 端点が保たれること。
  - linear-only 拒否: branching / merging / cycle / multiple-start / disconnected で期待エラー。
  - `INV-5`: `import * as api` の export 名に逆射影系が無いこと。
  - RBNF: `isResponsibilityBoundaryNormalForm` が正当な射影で `true`。
- コマンド:
  - `pnpm run check`(または `pnpm run typecheck`)で TypeScript が通ること。
  - `node --test`(または確立されたランナーの `pnpm test`)で全テストが緑であること。
- 手動確認:
  - `src/index.ts` の export 一覧を目視し、意味論語彙の追加と既存 export の維持を確認する。
  - README / docs の追記が semantic core と矛盾しないことを 1 箇所レビューする。
- 現時点で実行しない確認:
  - 静的契約証明(`ensures_A => requires_B`)、branching graph reachability、weak bisimulation minimization は将来作業のため対象外。

## リスク

- 公開コア API を additive にしても、`graph.ts` / `main.ts` / `sample.ts` や `add-reference-implementation-tests` のテストが既存名に依存する。rename を避けることで影響を抑える。破壊的整理が必要なら別 Issue で扱う。
- `Effect` の payload / delivery モデル化が semantic core の意図とずれると後続検証が誤った前提に立つ。`docs/semantic-core.md` の Effect model 節と逐次照合する。
- `INV-4` の leaf スコープ表明が、現行 `projectByResponsibilityBoundary`(flows 全体を `linearOrder`)の前提と食い違う場合、射影対象の絞り込みが必要になりうる。非 leaf を直接射影しない保証に範囲を限定し、scope 指定の一般化は将来作業とする。
- v0 の linear-only 制限は意図的に厳格である。テストは制限を緩めず、文書化された失敗を表明する。
- テストランナーの選定が `add-reference-implementation-tests` と重複しうる。`node:test` を共通既定とし、ランナーを二重に新設しない。

## 変更履歴

`CHANGES.md` impact: yes

項目案:

- Added: semantic core 語彙の型レイヤ(`BoundaryId`、`ActivityId`、`SchemaRef`、`Projection`、`RBNF`、opaque な `requires` / `ensures` 参照)、plain data の `Effect` 型、directed effect の boundary 検証ヘルパ(`validateDirectedEffect` / `knownBoundaryIds`)、leaf スコープ導出(`leafActivityIds`)を reference implementation コアへ追加(ランタイム依存ゼロ維持)。
- Added: 不変条件 `INV-1`〜`INV-6` と v0 linear-only 拒否・逆射影 API 不在を検証する `node:test` テスト。
- Changed: README / docs に、現行 v0 が semantic core の表明可能な部分集合のみを実装する旨を明記。

## 注記

- 関連: [[20260624-add-reference-implementation-tests]](テストランナーと boundary/projection/linear テストを担当。本 Issue はランナーを共有し重複新設しない)、[[20260624-document-semantic-core]](正典文書 `docs/semantic-core.md` の整備、Issue #2 由来)。
- 正典との緊張点の解決(committed defaults、実装を妨げない補足):
  - `Effect` / `World` / `ActivityResult` / `BoundaryProjection` は `docs/semantic-core.md` 5 行目で「将来ターゲット」と明記。本 Issue は `Effect` を plain data 型としてのみ追加し、実行 API(関数形 Activity、`seq`、World 更新)は導入しない。
  - 「公開 API を semantic 語で再構成」は additive(語彙追加・再 export)と解釈。破壊的 rename は将来の別 Issue とする。pre-release(`private`, `0.0.0`)であり破壊的整理は安価だが、本 Issue では in-flight な `add-reference-implementation-tests` との競合回避を優先する。
  - `requires` / `ensures` は opaque 参照の型語彙のみ追加。runtime contract checking(述語実行・連鎖検証)は `docs/semantic-core.md` の Verification milestones に v0 候補として残るが、本 Issue の受け入れ条件には含めず将来作業とする。
  - `Effect` をモデルスキーマへ埋め込むか(`ActivityDef.effects` 等)は将来判断。v0 は standalone + 検証ヘルパに留め、`schemaVersion: "responsible.v0"` を変更しない。
- ブランチ名を capture 時の `refactor/4-...` から `feat/4-...` へ変更。net で公開 API を追加し `CHANGES.md` の Added に該当するため(`git` スキルのブランチ type 基準)。
- GitHub: labels なし、createdAt `2026-06-24T14:13:14Z`、updatedAt `2026-06-24T14:17:22Z`、close comment `Captured as local issue. issues/open/20260624-align-reference-impl-semantic-core.md`(capture 時パス。本 polish で `issues/polished/` へ移動)。
