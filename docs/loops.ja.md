# ループ意味論

[English](loops.md) | 日本語

本書は、サイクル(ループ)——差し戻し・再申請・レビュー往復——を含む Activity グラフの射影と描画について規範となる文書である。[`docs/nonlinear-projection.md`](nonlinear-projection.md) で定義された DAG quotient 射影を拡張する。本書と [`docs/semantic-core.md`](semantic-core.md) が食い違う場合、コア意味論については `semantic-core.md` が、ループ射影については本書が正である。

Status: **設計確定・実装は段階計画**([Staged plan](#staged-plan) を参照)。Stage 1 が入るまで、`projectDagByResponsibilityBoundary`(`src/quotient.ts`)はサイクルを明確なエラーで拒否し続ける。

## Goals

- サイクルを含みうる有限 `ActivityGraph` に対する射影 `project` と、Responsibility Boundary Normal Form(RBNF)の拡張を定義する。
- ループ存在下でも不変条件 `INV-1`〜`INV-8` が成立すること(または再定式化)を示し、ループ固有の不変条件 `INV-9` / `INV-10` を追加する。
- ビューアの描画方針を確定する: 戻りエッジの表現と、境界ズームでループがどう現れ・消えるか。
- スキーマへの影響を決定する: ループは `responsible.v0` / `responsible.v1` 文書のまま扱い、`responsible.v2` は不要である。

## Non-goals

- **実行意味論は扱わない。** ループが何回回るか、終了条件、リトライ上限、タイムアウトはランタイムの関心であり、実行 API は README の非目標である。本書は反復の「構造」がどう射影・描画されるかだけを定義する。
- **モデルスキーマは変更しない。** DAG 射影と同じく、ループ射影はデータに対する射影能力である([Schema impact](#schema-impact) を参照)。
- **v0 線形プロジェクタは変更しない。** `projectByResponsibilityBoundary` はより厳格な線形の特殊ケースのままで、サイクルを拒否し続ける。

## Design summary

ループとは、リーフ flow グラフ上の有向サイクルである。採用した意味論は**射影レベルの縮約と導出戻りエッジ**である:

1. 既存の quotient 分割(同一境界の極大弱連結成分)はサイクル許容で計算する——分割自体は非巡回性を必要としておらず、必要としていたのは位相順序の前提だけだった。
2. 選択中のビューで 1 つの境界の内側で閉じるループは、その境界の composite に畳み込まれて不可視になる——**tau ループ規則**。同一境界の flow と同一境界の directed effect を隠す `tau` 規則と同じ形である。
3. 選択中のビューで境界をまたぐループは、*射影後の成分間の*サイクルとして生き残る。射影後グラフ上の正準順序(SCC 縮約の位相順序 + SCC 内の決定的順序)がビューを線形化し、その順序に逆行する射影後 flow を**戻りエッジ**(`kind: "return"`)として分類し、区別された後退エッジとして描画する。

この設計を動機づける鍵となる観察がある: 射影後の quotient グラフは、非巡回モデルからでも**既に**サイクルを持ちうる。`src/__tests__/quotient.test.ts`(“the quotient graph may contain cycles between distinct boundaries”)は DAG `a(t1) → b(t2)`, `a → c(t1)`, `b → c` を `t1 ⇄ t2` に射影し、ビューアはそれを描画済みである。つまりビューレベルの境界間サイクルは新しい語彙ではない。本設計は*出力*の言語を変えずに、*入力*のグラフクラスを拡張する。

## Graph class

入力は、選択スコープのリーフ上の有限有向 Activity グラフである:

- 分岐・合流・有向サイクルはスコープ内。
- スコープは引き続き弱連結でなければならない。非連結スコープはモデリングエラーのまま。
- **自己ループ(Activity から自分自身への flow)は明確なエラーで拒否する。**[Self-loops](#self-loops) を参照。

DAG のケースは特殊ケースであり続けなければならない: 非巡回モデルに対する結果は、現行の `projectDagByResponsibilityBoundary` の出力と一致する。

## Projection pipeline

選択された(ドリルダウンスコープ, 境界式)のビューに対し、`project` は次で定義される:

1. **Scope.** 現行どおり、スコープのリーフ Activity とその間の flow を取る(`INV-4`)。自己ループと弱非連結スコープは明確なエラーで拒否する。
2. **Partition.** 各リーフに `boundaryOf(activity, boundary)` で境界を割り当て、誘導された同一境界部分グラフの極大弱連結成分にリーフを分割する——[`docs/nonlinear-projection.md`](nonlinear-projection.md) の quotient 規則そのままである。このステップは元々非巡回性を要求していない。
3. **Collapse.** 各成分が 1 つの射影 Activity になる。成分内部の flow は自己エッジになり隠される(既存規則)。これが tau ループ規則を成立させる: このビューで全メンバーが 1 つの境界を共有するサイクルは 1 成分の内側に収まり、消える。
4. **Canonical order.** 射影後グラフはなおサイクルを含みうる——ちょうど、ループがこのビューで境界をまたぐときである。*射影後グラフの*強連結成分(SCC)とその縮約(condensation)を計算する。縮約は DAG である。射影 Activity の**正準順序**は: 縮約の位相順序(Kahn 法、FIFO、初出順で安定——既存の決定性規則)、および非自明な各 SCC の内部では SCC のエントリ成分(SCC 外からエッジを受ける成分、またはスコープ開始を含む成分)からの幅優先順序(同順位は初出順)。射影後グラフが非巡回なら全 SCC が単一ノードであり、正準順序は現行の位相順序*そのもの*である。
5. **Return classification.** 射影後 flow `u → v` は、正準順序で `v` が `u` より真に後なら**前進エッジ**、そうでなければ**戻りエッジ**(`kind: "return"`)である。異なる SCC 間のエッジは常に前進である(縮約は DAG)。return になりうるのは非自明な SCC 内部のエッジだけである。前進部分グラフは構成により非巡回で、射影後のあらゆるサイクルは少なくとも 1 本の戻りエッジを含む。

同じパイプラインをリーフレベルにも適用して、成分メンバーの順序と entry/exit 集合を導出する: composite 内のメンバー順と成分の列挙順は、*リーフ*グラフの正準順序(リーフグラフの SCC 縮約、ステップ 4 と同じ規則)に従う。entry/exit の導出と [`docs/nonlinear-projection.md`](nonlinear-projection.md) の直積スタイル型合成は変更なし——これらは元々、成分外部エッジとスコープの開始/終端で定義されており、いずれも非巡回性を仮定していない。

### RBNF extension

RBNF の quotient 規則は変更なし: 同一境界の内部ステップは `tau` として畳まれ、境界横断ステップは可観測である。ループが加えるのはより強い**代表元の選択**である: 正規形は正準順序と前進/戻り分類を追加で固定する。どちらもモデルとビューの決定的関数であり、射影は純粋で再現可能な関数のままである。

この分類は*代表元の選択*であって、意味論的主張ではない。サイクルのどのエッジが「差し戻しのエッジ」かはモデルに保存されておらず、射影もそれを断定しない。意味論的内容はサイクルそのもの(到達可能性、`INV-8`)である。異なる正準順序は異なるエッジを return と印づけるが、同じ quotient を記述する。これは RBNF が既に同値類の最小化された代表元を 1 つ選ぶこと(`docs/semantic-core.md` の "Normal form terminology")と相似である。

## The tau-loop rule(境界ズーム下の可視性)

> ループがあるビューで不可視であるのは、その全メンバー Activity がそのビューで同一の境界に射影されるとき、**かつそのときに限る**。

両方向とも分割規則から従う。全メンバーが 1 つの境界を共有するなら、サイクルの全エッジは同一境界 flow であり、メンバーは同一境界部分グラフで弱連結となって 1 成分に入り、サイクルは隠された自己エッジに畳まれる。サイクルのいずれかのエッジがこのビューで境界をまたぐなら、その両端は異なる成分に属し(成分が境界をまたぐことはない)、サイクルは射影後サイクルとして生き残り、正準順序の「巻き戻り」ごとにちょうど 1 本の戻りエッジを生む。

これは v1 effect 規則(「選択境界で解決済み source と directed target が一致する effect はそのビューで内部(`tau`)であり隠される」、[`docs/responsible-v1.md`](responsible-v1.md))のループ版である: 粗いビューが、より細かい境界の内部業務である反復を見られないのは正当である。ループを包む境界を越えてズームインすると、戻りエッジが現れる。

## Cross-boundary loops

境界をまたぐループ(部門 A → 部門 B → 部門 A)は、1 つの不透明なノードに畳むのではなく、参加する両成分を可視のまま、印づけられた戻りエッジ付きで表示する。これは SCC 丸ごと縮約に対して指摘されたリスクへの直接の解になっている: 粗いビューでも*どの*境界が往復しているかが見え、ループの責務の受け渡し——`INV-8` が保存を約束する境界横断の観測——が可観測のまま残る。

## Nested loops and drill-down

SCC は極大なので、単一のビューに「SCC の中の SCC」は存在しない。ネストはビューを横断して現れ、パイプラインはそれを一様な再帰で扱う——すべての(スコープ, 境界)ビューが同じ 5 ステップを適用する:

- **境界の細分化。**`department` で不可視のループ(営業部の内側で閉じる)は、メンバーがチームに分かれる `team` で現れうる。逆に、細かいビューで重なり合う 2 つのサイクルは、粗いビューで 1 つの射影後 SCC に合流したり、完全に消えたりする。
- **ドリルダウン。**分解スコープを開くと、そのスコープのリーフ上でパイプラインを再実行する。子スコープの内側で閉じるループはそこに現れ、独自の正準順序と戻りエッジを持つ。
- **ノードを共有するループ。**Activity を共有する 2 つのサイクルは 1 つの SCC を成す。正準順序は複数の戻りエッジで両方を表現する。特別扱いは不要である。

## Self-loops

flow `{ "from": "x", "to": "x" }` はモデリングエラーとして**拒否**し、構造検証が flow の JSON パス付きで報告する(プロジェクタも防御的に拒否する)。

理由: 自己ループの両端はすべての責務属性を共有するため、*どの*境界・どのズームレベルでも隠された自己エッジに射影される——どのビューも決して表示できない不可観測な構造であり、モデリングの自由というより静かな footgun である。ガイダンス付きの拒否は、本プロジェクトの「空白の出力より明確なエラー」方針と一貫する。単一 Activity の内部にある反復は、分解(flow がループを成す `children`、ドリルダウンで可視)か、契約語彙(差し戻し条件を記述する `requires` / `ensures`)でモデル化すべきである。

## Error reporting

ループ意味論の確定後、quotient プロジェクタに残る拒否経路は次のとおり:

| ケース           | 報告                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 弱非連結スコープ | 変更なしの明確なエラー(“one weakly connected flow”)。                                                                            |
| 自己ループ       | 新設: flow の JSON パス付き検証イシュー。加えてプロジェクタの防御的エラー(上記参照)。                                            |
| サイクル(一般)   | Stage 1 以降は**エラーではなくなる**。現行の “cycle detected” エラーとビューアのスコープ別エラーパネルは、段階計画で撤去される。 |

## Schema impact

- **モデルスキーマ: 変更なし。**ループ射影は `responsible.v0` / `responsible.v1` 文書に対する射影能力であり、DAG 射影と同じ既定の決定(`docs/nonlinear-projection.md`)に従う。`responsible.v2` は不要である。サイクルは既に `flows` で表現可能であり、今日は射影時に拒否されているだけである。
- **ビュー型: 追加フィールド 1 つ。**`ProjectedFlow`(`src/model.ts`)にオプショナルな `kind?: "return"` を追加する。前進エッジは今日の出力と形が同一のまま。`ProcessView` は JSON シリアライズ可能な出力であり続けるので、これはモデル文書の変更ではない。
- **Effects: 直交。**`projectEffects`(`src/effects.ts`)は Activity ごとに境界を解決し flow を辿らないので、宣言された v1 effect と `INV-3` の検査はサイクルの影響を受けない。
- **Contracts: 直交。**`requires` / `ensures` は Activity ごとの宣言である。サイクルを一周する整合的な契約連鎖(差し戻しが次の反復の要求する事実を再確立する)に新しい仕組みは不要である——例を参照。`draft` と `revise` はどちらも `Application.status = draft` を ensure し、それを `submit` が require する。

## Rejected alternatives

### モデルレベル SCC 縮約(単一ループスコープノード)

*モデル*グラフの各 SCC を射影前に 1 つの composite「ループスコープ」ノードに縮約する。グラフは DAG になり既存プロジェクタがそのまま使え、ループ内部はドリルダウンでのみ見える。

却下の理由:

- 境界をまたぐループ(部門 A ⇄ 部門 B)が、その受け渡しこそが重要なビューで単一ノードに畳まれ、どの境界が往復しているかが不可視になる。これは設計イシュー自身が挙げた情報喪失リスクであり、`INV-8` を弱める(SCC 内部の境界横断の観測が、保存されるのではなく射影後グラフから落ちる)。
- 視覚的に非一貫である: 非巡回モデルは既にビュー上の境界間サイクル(上記の `t1 ⇄ t2`)に射影され、そのように描画される一方、巡回モデル由来の同じ往復形状は 1 つの不透明ノードとして描画されることになる。同じ可観測構造に 2 つの見た目が生じる。
- 複数境界にまたがるループノードには帰属レーンがなく、レーンレイアウトはどのみち新しいノード種を必要とする。「DAG プロジェクタを無変更で再利用できる」という魅力の大半が消える。

### 明示ループ注釈(モデル flow への `kind: "return"`)

モデル作成者が文書内で戻り flow をマークし、射影はマーク済みエッジを特別扱いし、未マーク部分グラフの非巡回性を要求する。

却下の理由:

- 射影が導出できる情報のためのモデルスキーマ変更(`FlowDef` の新フィールド、したがって [`docs/responsible-v1.md`](responsible-v1.md) の互換性原則の下で `responsible.v2` 相当)である。
- 注釈の負担がすべてのモデル作成者にかかり、その検証(どのエッジもマークされていないサイクルや余計なマークの検出)には、導出設計が既に行うサイクル解析がそのまま必要になる——注釈は検証力を何も買わない。
- どのエッジが「戻り」かは表現レイヤの語彙であり、本プロジェクトの立場はビューは計算されるものである:「どう描くか」はモデルに属さない。導出分類はモデル文書を純粋に構造的なままに保つ。

将来の、任意の*ヒント*(整合する場合に正準選択を上書きする、モデル作成者の希望する戻りエッジ)は、この意味論を変えずに後から重ねられる。これは本設計には明示的に含まれない。

## Invariants under loops

| 不変条件 | ループ存在下                     | 備考                                                                                                                                             |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `INV-1`  | 成立                             | 分割・縮約・順序付け・分類はモデルとビューの純粋関数であり、射影は read-only のまま。                                                            |
| `INV-2`  | 成立(無関係)                     | ループは構造であり、mutation は実行の関心のまま。実行意味論は導入されない。                                                                      |
| `INV-3`  | 成立(無関係)                     | effect 射影は flow を辿らない。directed の source/target 解決とその検査は巡回性と独立。                                                          |
| `INV-4`  | 成立                             | 射影は引き続き選択スコープのリーフ Activity から計算する。縮約はリーフ射影の後段であって代替ではない。                                           |
| `INV-5`  | 成立                             | quotient は lossy かつ非可逆のまま。正準順序と return 分類は代表元の選択であり、逆写像を加えない。                                               |
| `INV-6`  | 成立(導出を再定式化、主張は同一) | 強連結領域も Activity 形の成分を生む: entry/exit は成分外部エッジとスコープ開始/終端で定義され、元々非巡回性を仮定していない。型合成は変更なし。 |
| `INV-7`  | 構成により成立                   | 異なる同一境界成分間の射影後エッジはありえない: そのようなエッジがあればステップ 2 で両成分は合流している。戻りエッジも含めて成立。              |
| `INV-8`  | 全エッジ集合上で成立             | 境界横断の観測間の到達可能性は、前進**と**戻りエッジを合わせて保存される。前進部分グラフ単体は完全な flow 関係ではなく、そう読んではならない。   |
| `INV-9`  | **新設**                         | すべての射影後 flow は、正準順序を真に増加させるか `kind: "return"` を持つ。したがって前進部分グラフは非巡回で、分類は決定的である。             |
| `INV-10` | **新設**                         | tau ループ規則: 選択ビューで全メンバーが 1 つの境界に射影されるサイクルは、そのビューにサイクルも戻りエッジも生まない。                          |

`INV-1`〜`INV-6` は [`docs/semantic-core.md`](semantic-core.md) で、`INV-7` / `INV-8` は [`docs/nonlinear-projection.md`](nonlinear-projection.md) で定義されている。

## Example: 差し戻しを含む申請承認

差し戻しの正準パターン——申請 → 審査 → 差し戻し → 申請。審査者の判断は Activity の出力である(分岐はゲートウェイではなく、判断を出力する Activity である)。`審査結果` は 差し戻し | 承認可 の union を表し、消費側の `requires` が分岐条件を明示する。完全なモデル(`responsible.v1` としてパース可能。Stage 2 がテストフィクスチャとして使う):

```json
{
  "schemaVersion": "responsible.v1",
  "activities": {
    "draft_application": {
      "id": "draft_application",
      "name": "申請書を作成する",
      "input": "顧客要望",
      "output": "申請書ドラフト",
      "status": "defined",
      "responsibility": {
        "company": "あおい商事",
        "department": "営業部",
        "section": "営業一課",
        "team": "見積チーム",
        "person": "山田"
      },
      "ensures": ["Application.status = draft"]
    },
    "submit_application": {
      "id": "submit_application",
      "name": "申請を提出する",
      "input": "申請書ドラフト",
      "output": "提出済み申請",
      "status": "defined",
      "responsibility": {
        "company": "あおい商事",
        "department": "営業部",
        "section": "営業一課",
        "team": "見積チーム",
        "person": "山田"
      },
      "requires": ["Application.status = draft"],
      "ensures": ["Application.status = submitted"]
    },
    "review_application": {
      "id": "review_application",
      "name": "申請を審査する",
      "input": "提出済み申請",
      "output": "審査結果",
      "status": "defined",
      "responsibility": {
        "company": "あおい商事",
        "department": "管理部",
        "section": "審査課",
        "team": "審査チーム",
        "person": "田中"
      },
      "requires": ["Application.status = submitted"],
      "ensures": ["Application.status = reviewed", "ReviewResult = 差し戻し | 承認可"],
      "effects": [
        {
          "payload": { "kind": "command", "schema": "差し戻し通知" },
          "delivery": {
            "mode": "directed",
            "target": {
              "company": "あおい商事",
              "department": "営業部",
              "section": "営業一課",
              "team": "見積チーム",
              "person": "山田"
            }
          }
        }
      ]
    },
    "revise_application": {
      "id": "revise_application",
      "name": "申請を修正する",
      "input": "審査結果",
      "output": "申請書ドラフト",
      "status": "defined",
      "responsibility": {
        "company": "あおい商事",
        "department": "営業部",
        "section": "営業一課",
        "team": "見積チーム",
        "person": "山田"
      },
      "requires": ["ReviewResult = 差し戻し"],
      "ensures": ["Application.status = draft"]
    },
    "approve_application": {
      "id": "approve_application",
      "name": "申請を承認する",
      "input": "審査結果",
      "output": "承認済み申請",
      "status": "defined",
      "responsibility": {
        "company": "あおい商事",
        "department": "管理部",
        "section": "審査課",
        "team": "承認チーム",
        "person": "鈴木"
      },
      "requires": ["ReviewResult = 承認可"],
      "ensures": ["Application.status = approved"]
    }
  },
  "flows": [
    { "from": "draft_application", "to": "submit_application" },
    { "from": "submit_application", "to": "review_application" },
    { "from": "review_application", "to": "revise_application" },
    { "from": "revise_application", "to": "submit_application" },
    { "from": "review_application", "to": "approve_application" }
  ]
}
```

サイクルは `submit → review → revise → submit`。リーフの SCC は `{draft}`, `{submit, review, revise}`, `{approve}` なので、正準リーフ順序は `draft, submit, review, revise, approve` である。

### 各境界レベルでの期待される射影

**`company`** —— すべての Activity が あおい商事。1 成分で flow なし。ループは不可視(`INV-10`)で、プロセスは外側の契約として読める:

```text
[あおい商事: 作成+提出+審査+修正+承認]   input: 顧客要望   output: 承認済み申請
```

射影 Activity: `composite:draft_application+submit_application+review_application+revise_application+approve_application`。flow: なし。

**`department`** —— 営業部 `{draft, submit, revise}`(同一境界 flow `draft→submit` と `revise→submit` を通じて弱連結)と 管理部 `{review, approve}`(`review→approve` で連結)。生き残るエッジ `submit→review` と `review→revise` が射影後サイクルを成す。正準順序はスコープ開始(`draft`)を含む成分から始まるので、`review→revise` の像が戻りエッジになる:

```text
[営業部: 作成+提出+修正] ──▶ [管理部: 審査+承認]
        ▲                        │
        └────── return ──────────┘
```

| 射影 Activity                         | 境界   | input                 | output                    |
| ------------------------------------- | ------ | --------------------- | ------------------------- |
| `composite:draft+submit+revise`(略記) | 営業部 | `顧客要望 & 審査結果` | `提出済み申請`            |
| `composite:review+approve`(略記)      | 管理部 | `提出済み申請`        | `審査結果 & 承認済み申請` |

flow: `営業部 → 管理部`(前進)、`管理部 → 営業部`(`kind: "return"`)。directed の `差し戻し通知` effect もこのビューで可視である——source(管理部)と target(営業部)がこのビューで異なるからである。

**`section`** —— `department` と同形: 営業一課 `{draft, submit, revise}` ⇄ 審査課 `{review, approve}`。

**`team`** —— 審査者と承認者が分かれる: 見積チーム `{draft, submit, revise}`、審査チーム `{review}`、承認チーム `{approve}`。正準順序: 見積, 審査, 承認。

```text
[見積チーム: 作成+提出+修正] ──▶ [審査チーム: 審査] ──▶ [承認チーム: 承認]
        ▲                             │
        └────────── return ───────────┘
```

flow: `見積 → 審査`(前進)、`審査 → 見積`(`kind: "return"`)、`審査 → 承認`(前進)。

**`person`** —— `team` と同形で、山田 `{draft, submit, revise}`、田中 `{review}`、鈴木 `{approve}`。戻りエッジは `田中 → 山田`。差し戻しの畳み込み(`draft+submit+revise`)はメンバーが 1 人の人物を共有するためどのレベルでも 1 つの composite のままであり、その内部はさらなるズームではなく、既存の composite 展開(内訳表示)で確認できる。

## Viewer rendering policy

- **前進スケルトン上のレイアウト。**正準順序が `flowIndex`(レーン内の x 軸位置)を与えるので、既存の層状レーンレイアウトは無変更で機能し続ける。戻りエッジは水平順序に関与しない。
- **戻りエッジは視覚的に区別される。**前進 flow エッジとも破線の effect エッジとも異なる: 後方へ湾曲して戻る曲線として配線し、向きが見誤りようのない矢頭を付ける(具体的なスタイルは Stage 3 の決定事項。要件は、前進 flow・戻り flow・effect の 3 種のエッジが判別可能であること)。
- **境界ズームの挙動は tau ループ規則に従う**: ループを包む境界より外へズームアウトすると、畳み込みとともに戻りエッジが消え、ズームインすると現れる。上の例の `company` と `department` の間で観察できる。
- **ドリルダウンは変更なし**: スコープを開くと同じパイプラインでそのスコープを再射影するので、子スコープの内側で閉じるループはそこに現れる。
- **エラーパネルの撤去**: ビューアのスコープ別「サイクル未対応」エラーパネルは Stage 3 で消える。自己ループと非連結スコープの明確な報告は残る。

## Staged plan

| Stage | Scope                                                                                                                                                 | Issue                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1     | コアのサイクル許容射影: 位相順序前提を正準順序(縮約 + SCC 内 BFS)に置換、戻りエッジ分類(`ProjectedFlow.kind`)、自己ループ拒否、DAG バイト互換、テスト | [#31](https://github.com/f4ah6o/responsible/issues/31) |
| 2     | 不変条件カバレッジ: ループ存在下の `INV-1`〜`INV-10`、本書の例をフィクスチャに、RBNF チェッカ更新、決定性と effect 直交性のテスト                     | [#32](https://github.com/f4ah6o/responsible/issues/32) |
| 3     | ビューア: 戻りエッジ描画、前進スケルトン上のレイアウト、差し戻しサンプル同梱 + `examples/` JSON、サイクルエラーパネル撤去、README 更新                | [#33](https://github.com/f4ah6o/responsible/issues/33) |

後続 stage は先行 stage の受け入れ条件が通るまで開始してはならないが、各 stage は独立に出荷可能である——[`docs/responsible-v1.md`](responsible-v1.md) と同じ進め方。

## Assertable subset

Stage 2 の後、テストは次を表明できなければならない:

- DAG モデルはループ対応前のプロジェクタとバイト同一に射影される(保存的拡張)。
- tau ループ規則(`INV-10`): 例が `company` では flow なしの単一 composite に、より細かいレベルでは文書どおりのサイクルに射影される。
- 前進部分グラフの非巡回性と決定的分類(`INV-9`)、反復射影の決定性を含む。
- 自己ループの JSON パス付き拒否。非連結スコープの拒否は変更なし。
- サイクルの存在によって `projectEffects` の結果が変わらないこと(`INV-3` 直交性)。
- 巡回入力に対する read-only 射影(`INV-1`)と逆射影 API の不在(`INV-5`)。
