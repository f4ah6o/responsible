# Data and Effects Model

This note defines how `responsible` treats data, mutation, observation, and effects.

## Core statement

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

Data is managed information owned by a Responsibility Boundary.

Data is not just a value. It has meaning, owner, lifecycle, and visibility.

```text
Data = meaning + owner + lifecycle + visibility
```

Example:

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

Data should be treated as a managed object inside a responsibility boundary, not as an independently flowing thing.

## Activity

An Activity is work performed inside a Responsibility Boundary.

Activities can observe, create, change, derive, publish, receive, delete, or archive data.

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

The Activity is the cause. Changes to data are results of the Activity.

## Mutation

A Mutation is a change to data caused by an Activity.

Mutation must not be described as if data changed by itself.

Bad:

```text
Invoice.status changes from Draft to Approved.
```

Good:

```text
ApproveInvoice changes Invoice.status from Draft to Approved.
```

A mutation should always have an Activity as its cause.

```yaml
mutation:
  target: Invoice.status
  from: Draft
  to: Approved
  causedBy: ApproveInvoice
```

## Effect

An Effect is the result of an Activity becoming observable across a Responsibility Boundary.

Mutation and Effect are different.

```text
Mutation = internal data change
Effect   = observable result across a boundary
```

Example:

```yaml
effects:
  - ApprovedInvoice is observable by Sales
  - InvoiceSent is observable by Customer
  - BillingRecord is published to ExternalSystem
```

Effect is relative to the selected boundary.

The same event may be internal mutation at one zoom level and external effect at another zoom level.

## Observe, Read, Reference

`read` is a concrete implementation-level form of `observe`.

```text
read ⊂ observe
```

`observe` means that an Activity recognizes the current value, state, or existence of data.

```yaml
observes:
  - Invoice.status
  - Invoice.amount
  - Customer.creditStatus
```

`reference` is different from observe. It means the Activity points to a concept, rule, document, data type, or responsibility, without necessarily reading a current value.

```yaml
refersTo:
  - ApprovalPolicy
  - AccountingRule
  - CustomerContract
```

Use `observes` for business-level notation. Project it to `reads` in implementation-level notation.

## requires and ensures

`requires` describes what must already be true for an Activity to be valid.

Japanese equivalents:

```text
前提
必要条件
開始条件
成立条件
```

`ensures` describes what is guaranteed after an Activity completes successfully.

Japanese equivalents:

```text
事後保証
完了後保証
成立後に保証される状態
```

## Data actions

Minimum vocabulary for how Activities act on Data:

| Action | Meaning |
| --- | --- |
| Observe | 観測する。Activity が判断材料として Data を認識する。 |
| Create | 作成する。 |
| Change | 変更する。内部状態を変える。 |
| Delete | 削除する。 |
| Derive | 派生する。既存 Data から別の Data を作る。 |
| Publish | 公開する。境界の外から見えるようにする。 |
| Receive | 受領する。境界の外から入ってきたものを受け取る。 |
| Archive | 保管する。 |

## State transition

State Transition is not the primary subject.

It is described as a sequence of Activities.

```text
Draft --ApproveInvoice--> Approved --SendInvoice--> Sent --ReceivePayment--> Paid
```

The Activity is the cause. The state transition is the result.

## Design principles

```text
Activity is the unit of responsibility.
Mutation is the internal result of Activity.
Effect is the externally observable result of Activity.
State Transition is the trace of Activities.
```
