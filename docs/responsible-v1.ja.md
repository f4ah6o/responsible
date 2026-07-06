# responsible.v1 スキーマ設計

[English](responsible-v1.md) | 日本語

本文書は `responsible.v1` モデルスキーマとその段階的実装に対する規範文書である。[`docs/semantic-core.md`](semantic-core.ja.md) の「future semantic target」を表明可能なスキーマへ具体化するものであり、両者が食い違う場合、意味論は `docs/semantic-core.md` が、スキーマの形は本文書が優先する。

## v1 とは何か

`responsible.v0` は Activity を、型付きインターフェイス（`input` / `output`）、`responsibility`、分解（`children`）だけで記述する。意味論のコアはすでに `requires` / `ensures` / `effects` というより豊かな語彙を定義している（[`docs/activity-effects.md`](activity-effects.ja.md)）が、v0 のモデル文書にはそれを書き込む場所がない。

`responsible.v1` は、その語彙を **プレーンな宣言的データとして** モデル文書の一部にする:

- `requires`: Activity を責任をもって開始するために既に成立していなければならない事実。
- `ensures`: Activity の正常完了後にモデル世界で成立する事実。
- `effects`: 成立した結果のうちどれが責任境界を越えて観測可能になるか、およびその配送規則の宣言。

## v1 でないもの

v0 から変わらず、v1 のスコープ外であることを明示する:

- **実行 API はない。** `World` / `ActivityResult` / Kleisli `seq` は引き続き future semantic target であり、スキーマにも API にもならない。
- **記号的述語はない。** `requires` / `ensures` の各項目は不透明な事実参照（文字列）である。`ensures_A => requires_B` の静的証明には述語 AST または DSL が必要で、将来課題のままである。
- **ループ意味論はない。** 循環は引き続き拒否される。
- **並行意味論はない。** [`docs/nonlinear-projection.md`](nonlinear-projection.ja.md) が扱う DAG の分岐・合流を超えるものは対象外。同文書の既決事項に注意: DAG projection はデータに対する能力であり v1 を **必要としない** — v1 が存在する理由は契約と作用であって、projection ではない。
- **逆射影はない**（`INV-5` は不変）。

## 互換性の原則

v1 は v0 の **厳密な上位集合** である:

- すべての妥当な `responsible.v0` 文書は、`schemaVersion` の書き換えだけで妥当な `responsible.v1` 文書になる。`migrateProcessModelToV1`（`src/migrate.ts`）はまさにそれだけを行う。
- パースと検証は両バージョンを受け入れる。新しい Activity フィールドが v0 文書に現れた場合はバージョンのヒント付きで拒否し、バージョン文字列の意味を保つ。
- 射影（`projectByResponsibilityBoundary` / `projectDagByResponsibilityBoundary`）はバージョン非依存である: v1 フィールドは射影グラフの形を変えず、その上で追加的に観測可能になるものだけを変える。

## スキーマ追加

追加はすべて `ActivityDef` 上のオプショナルなフィールドである。正典の型定義は `src/model.ts` にある。

```ts
type FactRef = string; // 不透明な事実。例: "Application.status = submitted"

type EffectPayloadDef = {
  kind: "domain-fact" | "command" | "data";
  schema: string; // SchemaRef
};

type EffectDeliveryDef =
  | { mode: "directed"; target: Responsibility } // 例: { role: "Manager" }
  | { mode: "broadcast" }
  | { mode: "observable" };

type EffectDef = {
  id?: string;
  payload: EffectPayloadDef;
  delivery: EffectDeliveryDef;
};

type ActivityDef = {
  // ...v0 のフィールドは不変...
  requires?: readonly FactRef[]; // v1
  ensures?: readonly FactRef[]; // v1
  effects?: readonly EffectDef[]; // v1
};
```

例（`docs/activity-effects.md` の一貫した例）:

```json
{
  "id": "submit",
  "input": "DraftApplication",
  "output": "SubmittedApplication",
  "responsibility": { "role": "Applicant" },
  "requires": ["Application.status = draft", "RequiredFields = complete"],
  "ensures": ["Application.status = submitted"],
  "effects": [
    {
      "payload": { "kind": "command", "schema": "ApprovalRequest" },
      "delivery": { "mode": "directed", "target": { "role": "Manager" } }
    }
  ]
}
```

### 設計判断

1. **`source` は導出され、決して宣言されない。** 意味論上の `Effect.source`（`src/semantic.ts`）は生成元 Activity とその射影後境界を指すが、モデル文書では生成元は宣言している Activity 自身であり、その境界は射影時に選択される境界式に依存する。`source` の宣言は冗長であり宣言位置と矛盾しうるため、`EffectDef` は `source` を持たない。`INV-3` の source 側は構成的に成立する。
2. **directed の `target` は `BoundaryId` ではなく `Responsibility` レコードである。** `"Engineering"` のような `BoundaryId` は境界式（`team`、`[project, function]` など）に相対的にしか存在しない。モデル文書は境界式から独立でなければならないため、target は `responsibility` の語彙（`{ "role": "Manager" }`）で宣言し、射影時に Activity と同じ `boundaryOf` 規則で `BoundaryId` に解決する。
3. **事実参照は不透明な文字列である。** v1 では人間のレビューのためにのみ比較され、等価性や含意の意味論は定義しない。悪い述語文法を凍結しないよう、記号的な事実言語は意図的に先送りする。
4. **`ensures` と `effects` は別々の宣言である。** 意味論上は `effects = project(ensures, boundary)` だが、v1 は不透明な事実からこの射影を計算できないため、観測可能な部分集合はモデラーが明示的に宣言する。将来の記号的事実言語により `effects` の `ensures` に対する検査が可能になりうる。

## 検証（Stage 1）

`validateProcessModel` は `schemaVersion` として `"responsible.v0"` と `"responsible.v1"` を受け入れ、JSON パス付きで以下を報告する:

- v0 文書に v1 フィールド（`requires` / `ensures` / `effects`）が現れた場合 → バージョンのヒント付きエラー。
- `requires` / `ensures`: 空でない文字列の配列であること。
- `effects[i].payload.kind` ∈ `domain-fact | command | data`、`schema` は空でない文字列であること。
- `effects[i].delivery.mode` ∈ `directed | broadcast | observable`、directed の配送は空でない `Responsibility` レコードを `target` に持つこと。

## Effect の射影（Stage 2）

`src/effects.ts` の `projectEffects` として実装済みであり、`src/__tests__/effects.test.ts` で検証されている。モデル・境界式・ドリルダウンスコープから意味論上の `Effect` 値を生成する読み取り専用のコア関数である:

```text
projectEffects(model, boundary, scopeId?) -> { ok: true; effects: Effect[] } | { ok: false; issues: ValidationIssue[] }
```

- スコープ内の各リーフ Activity について、各 `EffectDef` から `Effect` を生成する。`source.boundary` は `boundaryOf(activity, boundary)`、directed の target は宣言された target `Responsibility` に同じ規則を適用して解決する（`src/boundary.ts` の `boundaryOfResponsibility`）。
- **境界横断規則（RBNF と整合）:** 選択された境界において解決後の source と directed target が一致する effect は、そのビューでは内部的（`tau`）であり隠される。これは同一境界フローの collapse と対をなす。broadcast / observable の effect は常に保持される。
- 宣言された effect について `INV-3` が表明可能である: 解決後の target が選択ビューの既知の境界でない directed effect は JSON パス付きの issue として報告され（`validateDirectedEffect` を再利用）、黙って落とされることはない。
- **設計判断（実装時に解決）:** effect は独立した JSON シリアライズ可能な戻り値であり、`ProcessView` は変更しない。これにより互換性の原則どおりフロー射影はバージョン非依存のままになる。viewer は `Effect.source.activityId` をコンポーネントの `activityIds` に対応付けて effect をノードに紐づける。射影は読み取り専用（`INV-1`）かつ非可逆（`INV-5`）のままである。

## Viewer（Stage 3）

`src/viewer/` に実装済みであり、`src/__tests__/effect-flow.test.ts` で検証されている:

- 観測可能な effect は Activity ノード上のバッジ（payload schema と target または配送モード）として描画される。directed effect はさらに、生成元ノードから解決後の target 境界のレーンへの破線エッジとして描画され、不可視のレーンハンドルでアンカーされる。target のレーンが現在のビューの外にある directed effect はバッジのみに退化する。
- 境界横断規則は viewer 上で確認できる: `company` ズームではサンプルの directed effect は内部的（`tau`）で隠れ、`department`、`team` へズームすると現れる。broadcast の effect はすべてのレベルで表示される。
- effect はドリルダウンスコープを `scopeId` として渡しつつフルモデルに対して解決されるため、スコープ外の target も既知の境界のままであり `INV-3` を誤発火しない。実際に発生した `INV-3` 違反は、フローの描画を止めない notice パネルとして表示される。
- `ModelLoader` は二重バージョンパーサ経由で v1 文書を受け入れる。v0 文書とサンプルは従来どおり読み込める。`申請承認（契約と作用）` サンプル（`src/sample.ts`）と `examples/application-approval.v1.json` が契約と作用を実演し、他のサンプルは v0 のままである。

**モデリング上の注意:** 階層的な boundary zoom の下では、directed の `target` はビューが射影するすべての軸（例: `company` から `person` まで）を宣言すべきである。target に欠けている軸はそのズームレベルで `<unassigned>` に解決され、同じレベルに unassigned な Activity が存在しない限り `INV-3` に違反する。

## 不変条件

`INV-1`–`INV-8` はそのまま引き継ぐ。v1 が変えるのは表明可能性だけである:

- `INV-3`: モデルに宣言された effect について、source は構成的に正しく、directed target は射影時に検査される（Stage 2）。
- `INV-1` / `INV-5`: `projectEffects` は他のすべての射影と同じく読み取り専用かつ非可逆である。

## 段階的計画

| Stage | スコープ                                                                         | Issue                                                       |
| ----- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1     | スキーマ型、二重バージョン検証、`migrateProcessModelToV1`、テスト                | `issues/done/20260706-implement-v1-schema-core.md`          |
| 2     | `projectEffects`、境界横断規則、`INV-3` の表明、テスト                           | `issues/done/20260706-project-effects-across-boundaries.md` |
| 3     | viewer の effect 描画、v1 サンプル + example JSON、loader / README / docs の更新 | `issues/done/20260706-render-effects-in-viewer.md`          |

後続 Stage は先行 Stage の受け入れ条件が満たされる前に着手してはならないが、各 Stage は単独でリリース可能である。

## 表明可能な部分集合（v1）

Stage 2 完了後、テストで以下を表明できなければならない:

- 二重バージョンのパースと v0 → v1 マイグレーション（上位集合性）。
- `requires` / `ensures` / `effects` の構造的妥当性と JSON パス付きエラー。
- source の導出と directed target の解決を含む `Effect` の生成、および未知の target の拒否（`INV-3`）。
- 境界横断規則: 同一境界の directed effect は粗いビューで隠され、細かいビューで可視になる。
- フローグラフに対する射影が読み取り専用かつバージョン非依存のままであること。

「v1 でないもの」に挙げた項目は表明可能な部分集合の外にとどまる。
