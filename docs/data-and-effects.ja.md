# データと Effect モデル

[English](data-and-effects.md) | 日本語

この文書は、`responsible` がデータ、mutation、observation、effect をどのように扱うかを定義する。

## 中核となる主張

```text
Data does not mutate itself.
Only Activity mutates Data.
Only Effect crosses Responsibility Boundary.
```

日本語では次の意味である。

```text
データは自分では変化しない。
データは活動によってのみ変化する。
境界を越えて観測可能になった結果だけを Effect と呼ぶ。
```

## Data

Data は、Responsibility Boundary が所有する管理された情報である。

Data は単なる値ではない。意味、所有者、ライフサイクル、可視性を持つ。

```text
Data = meaning + owner + lifecycle + visibility
```

例:

```yaml
data:
  Invoice:
    owner: Accounting
    meaning: 請求内容を表す
    visibility: internal
    lifecycle:
      - Draft
      - Approved
      - Sent
      - Paid
```

Data は、独立して流れるものではなく、責任境界の内側で管理されるオブジェクトとして扱うべきである。

## Activity

Activity は、Responsibility Boundary の内側で行われる作業である。

Activity は、データを observe（観測）、create（作成）、change（変更）、derive（派生）、publish（公開）、receive（受領）、delete（削除）、archive（保管）できる。

```yaml
activity:
  name: ApproveInvoice
  responsibility: Accounting
  requires:
    - Invoice.status == Draft
    - Approver has approval authority
  observes:
    - Invoice.status
    - Invoice.amount
  refersTo:
    - ApprovalPolicy
  changes:
    - Invoice.status: Draft -> Approved
    - Invoice.approvedBy: null -> Approver
    - Invoice.approvedAt: null -> now
  ensures:
    - Invoice.status == Approved
    - Invoice.approvedBy exists
    - Invoice.approvedAt exists
  effects:
    - ApprovedInvoice is observable outside Accounting
```

Activity が原因であり、データへの変更はその Activity の結果である。

## Mutation

Mutation は、Activity によって引き起こされるデータへの変更である。

Mutation は、データが自分自身で変化したかのように記述してはならない。

悪い例:

```text
Invoice.status changes from Draft to Approved.
```

良い例:

```text
ApproveInvoice changes Invoice.status from Draft to Approved.
```

Mutation には、常にその原因となる Activity がなければならない。

```yaml
mutation:
  target: Invoice.status
  from: Draft
  to: Approved
  causedBy: ApproveInvoice
```

## Effect

Effect は、Activity の結果が Responsibility Boundary を越えて観測可能になったものである。

Mutation と Effect は異なる。

```text
Mutation = internal data change
Effect   = observable result across a boundary
```

例:

```yaml
effects:
  - ApprovedInvoice is observable by Sales
  - InvoiceSent is observable by Customer
  - BillingRecord is published to ExternalSystem
```

Effect は、選択された境界に対して相対的である。

同じ出来事でも、あるズームレベルでは内部の mutation であり、別のズームレベルでは外部への effect になり得る。

## Observe, Read, Reference

`read` は `observe` の、実装レベルで具体化された形である。

```text
read ⊂ observe
```

`observe` は、Activity がデータの現在の値、状態、あるいは存在を認識することを意味する。

```yaml
observes:
  - Invoice.status
  - Invoice.amount
  - Customer.creditStatus
```

`reference` は observe とは異なる。それは、Activity が現在の値を読むことなく、概念、規則、文書、データ型、あるいは責任を指し示すことを意味する。

```yaml
refersTo:
  - ApprovalPolicy
  - AccountingRule
  - CustomerContract
```

業務レベルの記法では `observes` を使う。実装レベルの記法では、それを `reads` へ投影する。

## requires と ensures

`requires` は、Activity が有効であるために、すでに成立していなければならない条件を記述する。

日本語での対応語:

```text
前提
必要条件
開始条件
成立条件
```

`ensures` は、Activity が正常に完了した後に保証される内容を記述する。

日本語での対応語:

```text
事後保証
完了後保証
成立後に保証される状態
```

## データへの操作

Activity がデータに対して行う操作の最小語彙:

| 操作    | 意味                                                  |
| ------- | ----------------------------------------------------- |
| Observe | 観測する。Activity が判断材料として Data を認識する。 |
| Create  | 作成する。                                            |
| Change  | 変更する。内部状態を変える。                          |
| Delete  | 削除する。                                            |
| Derive  | 派生する。既存 Data から別の Data を作る。            |
| Publish | 公開する。境界の外から見えるようにする。              |
| Receive | 受領する。境界の外から入ってきたものを受け取る。      |
| Archive | 保管する。                                            |

## 状態遷移

State Transition（状態遷移）は主題ではない。

それは Activity の並びとして記述される。

```text
Draft --ApproveInvoice--> Approved --SendInvoice--> Sent --ReceivePayment--> Paid
```

Activity が原因であり、状態遷移はその結果である。

## 設計原則

```text
Activity is the unit of responsibility.
Mutation is the internal result of Activity.
Effect is the externally observable result of Activity.
State Transition is the trace of Activities.
```
