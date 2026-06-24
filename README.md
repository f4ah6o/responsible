# responsible

> 仮称。名前は後で変更する。

`responsible` は、業務プロセスの可視化と定義、発見のための Activity モデリング実験である。

中心概念は、BPMN のような図そのものではなく、型付き Activity の合成モデルである。
表示は BPMN の lane / swimlane 的にできるが、内部モデルはより単純に保つ。

```text
Activity<Input, Output>
```

すべては Activity である。

---

## Theoretical position

`responsible` is an Activity-centered semantic core.

It models typed Activity composition, Responsibility Boundary projection, and Responsibility Boundary Normal Form. It is not a BPMN runtime, RACI chart tool, Event Sourcing runtime, Actor runtime, or State Machine runtime.

The reference implementation keeps the core small: plain TypeScript data, pure projection functions, and `ProcessModel -> ProcessView`. Visualization, BPMN-like lane rendering, DSL parsing, persistence, and execution runtimes are downstream layers.

Normative semantic rules are documented in `docs/semantic-core.md`. Theory background and implementation role mapping are documented in `docs/theory.md`. The older `docs/research-report.md` remains background research, not the source of normative design rules.

---

## Core idea

業務は Activity の合成として表す。

```text
Activity A: Input -> X
Activity B: X -> Y
Activity C: Y -> Output

Process = C ∘ B ∘ A
```

Activity は無限に入れ子にできる。
親 Activity は、子 Activity の合成として扱う。

```text
Activity<Input, Output>
  ├─ Activity<Input, A>
  ├─ Activity<A, B>
  └─ Activity<B, Output>
```

詳細化とは、以下を同時に進めることである。

```text
1. Activity を分解する
2. Input / Output のデータ型を厳密化する
3. Activity 間の受け渡し契約を厳密化する
```

ただし、受け渡し契約やデータモデルは後から厳密化されるものであり、最初から別の中心概念として扱わない。
中心は常に Activity である。

---

## Everything is Activity

Start event / End event / Trigger / Gateway のような BPMN 的な特別扱いは、内部モデルでは原則として不要である。

### Start / End

Start / End はドメイン上の実体ではなく、View の境界である。

```text
(view boundary)
  -> Activity
  -> Activity
  -> Activity
(view boundary)
```

現実には、仕事の前には仕事があり、仕事の後にも仕事がある。
したがって Start / End は、表示範囲を切るための境界として扱う。

### Trigger

Trigger は特殊ケースである。
通常は、ある Activity の Output が次の Activity の Input になる。

```text
Activity A: X -> Y
Activity B: Y -> Z
```

Trigger と呼ぶものは、未展開または外部の上流 Activity の Output とみなせる。

```text
External Activity: ExternalInput -> TriggerData
Internal Activity: TriggerData -> Output
```

### Gateway

分岐や判定も Activity である。

```text
Activity<Estimate, ApprovalRoute>
```

例外処理も Activity である。

```text
Activity<InvoiceInput, Result<ValidatedInvoiceInput, InvoiceInputError>>
```

---

## Activity as a typed function

Activity は、入力データ型を受け取り、出力データ型を返す業務関数として定義する。

```text
Activity<InputType, OutputType>
```

例:

```text
receive_inquiry: Inquiry -> EstimateRequest
create_estimate: EstimateRequest -> Estimate
approve_estimate: Estimate -> ApprovedEstimate
accept_order: ApprovedEstimate -> AcceptedOrder
```

合成すると、親 Activity になる。

```text
receive_order: Inquiry -> AcceptedOrder
```

このとき、内部の中間データ型は親 Activity の外からは見えない。

---

## Responsibility boundary

Activity には責任属性を与える。

例:

```yaml
activity: create_estimate
input: EstimateRequest
output: Estimate
responsibility:
  person: Sato
  team: Sales Team 1
  section: Sales Section
  department: Sales Department
  company: Example Construction
  function: sales
  role: estimator
  system: Excel
```

ただし、Activity の本質は組織構造ではない。
組織構造は、Activity に付与される責任属性である。

```text
Activity = Input -> Output
Responsibility = Activity をどの責任境界に属させるか
```

---

## Responsibility Boundary Normal Form

View は、どの責任境界で Activity を見るかを選ぶ。

```text
boundaryOf(activity, view) -> BoundaryId
```

ある View が Responsibility Boundary Normal Form であるとは、表示される任意の連続 Activity `a -> b` について、次が成り立つことである。

```text
boundaryOf(a) != boundaryOf(b)
```

同じ責任境界の Activity が連続する場合、それらは表示上合成される。

```text
A: I -> X
B: X -> O

boundaryOf(A) == boundaryOf(B)

Composite(A, B): I -> O
```

これにより、表示上は同じ責任境界の Activity が連続しない。

---

## Digital zoom

このモデルにおけるズームは、図形の拡大縮小ではない。

```text
Zoom = choose boundary
```

つまり、どの責任境界を可視化するかを切り替えることがズームである。

例:

```text
person view
  -> team view
  -> section view
  -> department view
  -> company view
  -> group view
```

同じ Activity モデルから、責任境界を変えるだけで異なる粒度の View を生成する。

```text
Activity は変えない
Boundary を変える
View が変わる
```

---

## Projection

詳細な Activity Graph を、選択した責任境界で射影する。

```text
Process View = normalize(project(ActivityGraph, boundary))
```

意味としては、以下である。

```text
業務プロセス図 =
  Activity Graph を
  指定された責任境界で射影し、
  同じ責任境界の連続 Activity を合成したもの
```

課単位で書いたモデルを、部単位、会社単位、企業間単位へ上げられる。

```text
section view:
  Sales Section -> Estimation Section -> Construction Section

department view:
  Sales Department -> Construction Department

company view:
  Customer -> Example Construction -> Partner Company -> Customer
```

---

## Lane view

表示は BPMN の lane / swimlane 風にできる。

ただし、lane は内部モデルの本質ではない。

```text
Responsibility boundary = meaning
Lane = visualization
```

例:

```text
Sales Department
  [Handle estimate request]
      ->
Construction Department
  [Prepare construction work]
      ->
Accounting Department
  [Issue invoice]
```

同じモデルでも、View が選ぶ boundary によって lane は変わる。

```text
boundary = department
boundary = role
boundary = system
boundary = project
boundary = [project, function]
```

---

## Organization models

この記法は、特定の組織形態に依存しない。

### Functional organization

職能型組織では、`function` や `department` を boundary として使う。

```text
sales -> engineering -> procurement -> accounting
```

### Hierarchical organization

階層型組織では、責任階層を辿ってズームできる。

```text
person < team < section < department < division < company < group
```

### Matrix organization

マトリクス型組織では、責任境界は単一ツリーではなく複数軸になる。

例:

```text
function axis:
  sales / engineering / accounting

project axis:
  Project A / Project B / Project C

authority axis:
  responsible / accountable / consulted / informed
```

Activity は複数の責任属性を持てる。

```yaml
activity: approve_change_order
input: ChangeOrderRequest
output: ApprovedChangeOrder
responsibility:
  project: Project A
  function: sales
  department: Sales Department
  raci:
    responsible:
      - Sales Representative
    accountable:
      - Project Manager
    consulted:
      - Construction Department
      - Accounting Department
    informed:
      - Customer Representative
```

View は、どの軸を boundary とするかを選ぶ。

```text
boundary = function
boundary = project
boundary = raci.responsible
boundary = raci.accountable
boundary = [project, function]
```

複合 boundary も定義できる。

```text
boundaryOf(activity) = (project, function)
```

この場合、同じ project かつ同じ function の Activity が連続すれば合成される。
project または function が変われば、責任境界として表示される。

---

## Minimal DSL sketch

```text
activity receive_inquiry: Inquiry -> EstimateRequest {
  responsibility {
    section SalesSection
    department SalesDepartment
    company ExampleConstruction
    function sales
    role sales_rep
    system Mail
  }
}

activity create_estimate: EstimateRequest -> Estimate {
  responsibility {
    section EstimationSection
    department SalesDepartment
    company ExampleConstruction
    function sales
    role estimator
    system Excel
  }
}

activity approve_estimate: Estimate -> ApprovedEstimate {
  responsibility {
    section SalesSection
    department SalesDepartment
    company ExampleConstruction
    function sales
    role approver
    system Workflow
  }
}

activity accept_order: ApprovedEstimate -> AcceptedOrder {
  responsibility {
    section SalesSection
    department SalesDepartment
    company ExampleConstruction
    function sales
    role sales_rep
    system kintone
  }
}

flow receive_inquiry -> create_estimate
flow create_estimate -> approve_estimate
flow approve_estimate -> accept_order
```

View:

```text
view section_view {
  layout lane
  boundary section
  normalForm responsibilityBoundary
}

view department_view {
  layout lane
  boundary department
  normalForm responsibilityBoundary
}

view company_view {
  layout lane
  boundary company
  normalForm responsibilityBoundary
}

view project_function_view {
  layout lane
  boundary [project, function]
  normalForm responsibilityBoundary
}
```

---

## Minimal schema sketch

```ts
type ProcessModel = {
  schemaVersion: "responsible.v0";
  activities: Record<string, ActivityDef>;
  types: Record<string, TypeDef>;
  flows: FlowDef[];
  views: ViewDef[];
};

type ActivityDef = {
  id: string;
  name?: string;
  input: TypeRef;
  output: TypeRef;
  responsibility?: Responsibility;
  children?: string[];
  status?: "discovered" | "defined" | "validated" | "automatable";
};

type Responsibility = Record<string, unknown>;

type FlowDef = {
  from: string;
  to: string;
  mapping?: string;
  contract?: string;
};

type ViewDef = {
  id: string;
  layout: "lane";
  boundary: BoundaryExpr;
  normalForm: "responsibilityBoundary";
};

type BoundaryExpr = string | string[];

type TypeRef = string;

type TypeDef = PrimitiveType | RecordType | UnionType | ResultType;
```

---

## Design principles

1. すべては Activity である。
2. Activity は `Input -> Output` の型付き関数である。
3. Activity は無限に入れ子にできる。
4. 親 Activity は子 Activity の合成である。
5. Start / End は View 境界であり、ドメイン上の特別な実体ではない。
6. Trigger は未展開または外部の上流 Activity の Output である。
7. Relation を中心概念にしない。
8. 受け渡し契約は、詳細化に伴って厳密化される。
9. データモデルも、詳細化に伴って厳密化される。
10. レーンは責任境界の可視化である。
11. ズームとは責任境界を切り替えることである。
12. 同じ責任境界の連続 Activity は、表示上合成される。
13. どの責任境界を採用するかは利用者の裁量である。
14. 階層型、職能型、マトリクス型の組織を同じ記法で扱う。
