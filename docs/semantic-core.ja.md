# セマンティックコア

[English](semantic-core.md) | 日本語

この文書は `responsible` のセマンティックコアに対して規範的（normative）である。

現在のリファレンス実装は、`docs/reference-implementation.md` に記述されている小さな TypeScript モデルのままである: plain なデータ構造、純粋関数、そして `ProcessModel -> ProcessView`。以下の TypeScript スニペットのうち `World`、`ActivityResult`、`Effect`、`BoundaryProjection` に言及するものは、将来のセマンティックな目標であり、`src/model.ts` の現在の export された API ではない。

## 位置づけ

`responsible` は、業務を Responsibility Boundary の内側にある Activity の合成としてモデル化する。

これは BPMN の runtime でも、RACI チャートツールでも、Event Sourcing の runtime でも、Actor の runtime でも、State Machine の runtime でもない。それらはコミュニケーション層、下流の projection、あるいは実装アダプタになり得る。それらはセマンティックコアではない。

中心となる用語は次のとおりである。

- Activity: 責任を担う作業の単位。
- Responsibility Boundary: 作業と effect が観測される、選択された境界。
- Projection: より豊かなモデルまたは事実の集合から、選択された境界への view。
- RBNF: 同一境界内の内部ステップを隠す、境界に projection された quotient view。

## Activity

現在の v0 では、`src/model.ts` は `ActivityDef` を、`input`、`output`、`responsibility`、そして省略可能な `children` を持つ plain なデータとして公開している。

セマンティックな目標はより豊かである: Activity は、モデルの world に対する効果的な計算として読むことができる。`World` は実世界ではない。それは `responsible` が記述し、検査できるモデルの世界、あるいは責任の状態である。

将来のセマンティックな目標であり、現在の v0 API ではない:

```ts
// Future semantic target; not exported by src/model.ts in current v0.
type Activity<I, O> = (world: World, input: I) => ActivityResult<O>;

// Future semantic target; not exported by src/model.ts in current v0.
type ActivityResult<O> = {
  world: World;
  output: O;
  effects: Effect[];
};
```

これは、Activity がモデルの `World` と `input` を消費し、新しい `World`、`output`、そして明示的な `Effect[]` の値を返すことを述べている。Effect は値であり、隠された runtime の副作用ではない。

## 合成

順次合成は、`Input -> Output` に対する単純な関数合成ではない。それは `World` と、蓄積された `Effect[]` に対する Kleisli 合成である。

将来のセマンティックな目標であり、現在の v0 API ではない:

```ts
// Future semantic target; not exported by src/model.ts in current v0.
const seq =
  <A, B, C>(f: Activity<A, B>, g: Activity<B, C>): Activity<A, C> =>
  (world, input) => {
    const r1 = f(world, input);
    const r2 = g(r1.world, r1.output);

    return {
      world: r2.world,
      output: r2.output,
      effects: [...r1.effects, ...r2.effects],
    };
  };
```

`seq(f, g)` は別の Activity を返す。これが、親 Activity を子 Activity の合成として扱うことができるセマンティックな理由である。

## Predicate と語彙

この語彙は `docs/activity-effects.md` と `docs/data-and-effects.md` に従う。

- `requires`: Activity が責任をもって開始できるために、すでに成立していなければならない事実。
- `ensures`: Activity が正常に完了した後、モデルの world に成立している事実。
- `effects`: 成立した事実のうち、Responsibility Boundary を越えて観測可能になる projection。
- `mutation`: Activity によって引き起こされる、実装ローカルなデータの変更。

現在の v0 の predicate は opaque な runtime predicate である。呼び出すことはできるが、コアは `ensures_A => requires_B` を静的に証明することはできない。Hoare 流の静的検証には symbolic な predicate AST または DSL が必要であり、将来の課題である。

将来のセマンティックな目標であり、現在の v0 API ではない:

```ts
// Future semantic target; not exported by src/model.ts in current v0.
type ContractResult = { ok: true } | { ok: false; reason: string };

// Future semantic target; not exported by src/model.ts in current v0.
type Requires<I> = (world: World, input: I) => ContractResult;
type Ensures<O> = (world: World, output: O) => ContractResult;
```

## Projection

Projection は読み取り専用の view 操作である。Projection は、元のモデルやモデルの world を変更してはならない。

セマンティックな関係は次のとおりである。

```text
effects = project(ensures, boundary)
```

現在の v0 実装は、モデルのレベルで同じ形を持つ。

```text
ProcessModel -> ProcessView
```

事実の projection とモデルの projection は、同じ発想の 2 つの実例である: ある境界から観測可能なものを選び、内部に残るものを隠す。

将来のセマンティックな目標であり、現在の v0 API ではない:

```ts
// Future semantic target; not exported by src/model.ts in current v0.
interface BoundaryProjection<In, Out> {
  project(input: In, boundary: BoundaryId): Out;
}
```

現在の TypeScript コアでは、`projectByResponsibilityBoundary(model, view)` が具体的な v0 の projection 関数である。選択された Activity のスコープと境界表現に対して leaf Activity を projection し、JSON 直列化可能な `ProcessView` を返す。

## Responsibility Boundary Normal Form

Responsibility Boundary Normal Form、すなわち RBNF は、主として境界越えの観測的等価性による quotient view である。

選択された境界に対して:

- 同一境界内の内部ステップは、silent action である `tau` として扱われる。
- 境界を越える effect は observable action として扱われる。
- 連続する `tau` ステップは、選択された境界からは観測できないため、collapse できる。

RBNF はまた、選択された境界への projection でもある。それは lossy であり、非可逆である。コアは、RBNF view から元の詳細なモデルを復元できると主張する restoration API を提供してはならない。

normal form という用語は、projection が等価類の最小化された代表を選択する場合にのみ当てはまる。その代表の選択がない場合、RBNF は一意な canonical normal form ではなく、quotient view あるいは projection として記述すべきである。

現在の v0 は線形フローのみをサポートする。v0 では、RBNF は同一境界の連続実行に対する continuous な `tau` collapse に還元されている。分岐、合流、あるいは並列グラフに対する一般的な weak bisimulation の最小化ではない。

## Effect モデル

Effect は mutation ではない。Mutation は Activity によって引き起こされる内部的なデータの変更である。Effect は、Activity が Responsibility Boundary を越えたことによる観測可能な結果である。

将来のセマンティックな目標であり、現在の v0 API ではない:

```ts
// Future semantic target; not exported by src/model.ts in current v0.
type Effect = {
  source: {
    activityId: ActivityId;
    boundary: BoundaryId;
  };
  payload:
    | { kind: "domain-fact"; schema: SchemaRef }
    | { kind: "command"; schema: SchemaRef }
    | { kind: "data"; schema: SchemaRef };
  delivery:
    | { mode: "directed"; target: BoundaryId }
    | { mode: "broadcast" }
    | { mode: "observable" };
};
```

3 つの関心事は次のとおりである。

- `source`: どの Activity と source boundary が観測可能な結果を生み出したか。
- `payload`: 境界を越える結果がどの種類のものか。
- `delivery`: directed、broadcast、あるいは一般的に observable といった、境界越えの可視性ルール。

`delivery` が可視性のルールである。セマンティックコアには、別個の可視性の軸は存在しない。

## 不変条件

これらの不変条件は、assertable あるいは reviewable な条件として表現される。

- `INV-1`: View の projection は、`ProcessModel`、`World`、Activity の定義、あるいはソースとなる事実を変更してはならない。
- `INV-2`: Mutation は Activity の実行によって引き起こされなければならず、その Activity の world 更新の内側に留まらなければならない。
- `INV-3`: directed な effect は、既知の source boundary と既知の target boundary を持たなければならない。
- `INV-4`: Boundary projection は、選択された Activity のスコープ内の leaf Activity から行われなければならない。
- `INV-5`: RBNF の collapse は非可逆として扱わなければならない。collapse された view から lossless に復元できると主張する API があってはならない。
- `INV-6`: Activity の合成は Activity を返さなければならず、親 Activity と子 Activity の合成可能性を保存しなければならない。

## 検証のマイルストーン

v0 の runtime チェック:

- opaque な `requires` と `ensures` に対する runtime の契約チェック。
- 利用可能な場合、隣接する Activity の predicate を実行することによる契約チェーンの一貫性。
- directed な effect に対する既知の source boundary と target boundary を含む、Effect と境界の一貫性。
- Projection の一貫性: projection は読み取り専用であり、有効な境界参照を保存する。
- View の一貫性: RBNF の view は、隣接する同一境界の projection されたステップを含まない。

将来の静的検証:

- 静的な契約証明のための symbolic な predicate AST または DSL。
- `ensures_A => requires_B` の静的証明。
- 分岐グラフの到達可能性。
- デッドロックとライブロックのチェック。
- 分岐、合流、並列拡張に対するワークフロー健全性。
- v0 の線形な `tau` collapse を越える、一般的な quotient と weak bisimulation の最小化。
