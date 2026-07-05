# Activity, 前提, 成立, 作用

[English](activity-effects.md) | 日本語

Responsible は、状態遷移図ではなく、責任ある Activity の合成として状態遷移が立ち上がる記法である。

この文書では、データへの作用、副作用、mutation を中心概念にせず、Activity を中心に世界の変化を記述するための最小語彙を定義する。

## 最小語彙

```text
Activity = 活動
requires = 前提
ensures  = 成立
effect   = 作用
```

## Activity

Activity は、責任主体が行う活動である。

```text
Activity
  = 責任主体が、責任境界の内側で行う活動
```

Activity は単なるデータ操作ではない。

Activity は、前提を満たす世界に対して行われ、完了後に新しい事実を成立させる。

```text
Activity:
  前提を満たす世界
    -> 新しい事実が成立した世界
```

## 前提

`requires` は、Activity が責任をもって開始できるために、すでに成立していなければならない条件である。

```text
requires = 前提
```

例:

```text
activity "申請を提出する" by "申請者" {
  requires {
    申請.status = draft
    必須項目 = complete
  }
}
```

これは次の意味である。

```text
申請が下書きであり、必須項目が揃っていることを前提に、
申請者は「申請を提出する」という Activity を行える。
```

前提は、単なる input ではない。

```text
input / uses
  判断や活動に使う値

requires / 前提
  活動が成立するために世界に成り立っているべき条件
```

## 成立

`ensures` は、Activity が完了した後に世界に成立している事実である。

```text
ensures = 成立
```

例:

```text
activity "申請を提出する" by "申請者" {
  ensures {
    申請.status = submitted
    提出事実(申請, 申請者) = true
  }
}
```

これは次の意味である。

```text
Activity の完了によって、
申請が提出済みであること、
申請者が提出したこと、
という事実が成立する。
```

成立は、DB 更新やオブジェクトの mutation ではない。

```text
避けたい表現:
  update 申請.status submitted
  insert 提出履歴

Responsible での表現:
  申請.status = submitted が成立する
  提出事実(申請, 申請者) = true が成立する
```

実装では update / insert / event append になる可能性がある。
しかし Responsible の主語彙では、操作ではなく、Activity 後の世界に成立している事実を書く。

## 作用

Effect は、Activity の結果が責任境界を越えて観測可能になることである。

```text
Effect は、Activity の結果が責任境界を越えて観測可能になること。
```

日本語の概念名は `作用` とする。

```text
effect = 作用
```

例:

```text
activity "申請を提出する" by "申請者" {
  requires {
    申請.status = draft
    必須項目 = complete
  }

  ensures {
    申請.status = submitted
    提出事実(申請, 申請者) = true
  }

  effects {
    承認依頼 to 課長
  }
}
```

これは次の意味である。

```text
申請者の責任境界で成立した「申請が提出済みである」という事実が、
承認依頼として課長の責任境界から観測可能になる。
```

作用は、世界を変える。

ただし Responsible で重要なのは、世界の変化を低レベルの mutation として書くことではない。
重要なのは、ある責任境界の内側で成立した事実が、別の責任境界から観測可能になることである。

## Activity の合成

Activity は、成立と前提によって接続される。

```text
Activity A ensures X
Activity A effects X to Boundary B
Activity B requires X
```

日本語では次のように読める。

```text
A の成立が、B の前提になる。
```

この接続によって Activity が並ぶ。

```text
申請を作成する
  -> 申請を提出する
  -> 申請を承認する
  -> 次工程を開始する
```

状態遷移は、この Activity の並びから導出される。

```text
absent -> draft -> submitted -> approved
```

Responsible は状態遷移を直接主語にしない。
Activity の合成として状態遷移が立ち上がる。

## 関数型パラダイムとの対応

関数型パラダイムに寄せると、Activity は次のように読める。

```text
Activity : World -> (World, Effect[])
```

ただし、Effect を Activity の内部に隠して実行しない。
Effect を値として明示する。

Responsible では、次のように対応する。

```text
requires
  Activity に入る前の世界の条件

ensures
  Activity 後の世界に成立する事実

effects
  その成立が責任境界を越えて観測可能になる作用
```

## Data / State / Mutation

Responsible の主語彙では、mutation を中心概念にしない。

```text
Data
  = 値

State
  = ある時点で世界に成立している事実の集合

Mutation
  = 実装上の変更操作
```

Responsible が書くのは、操作ではなく、活動後に成立している事実である。

例:

```text
activity "申請を承認する" by "課長" {
  requires {
    申請.status = submitted
    承認権限(課長, 申請) = true
  }

  ensures {
    申請.status = approved
    承認事実(申請, 課長) = true
  }

  effects {
    承認結果 to 申請者
    次工程依頼 to 経理
  }
}
```

ここで中心になるのは `申請.status を update する` ではない。

中心になるのは次である。

```text
課長の Activity によって、
申請が承認済みであること、
課長が承認したこと、
という事実が成立する。

その成立が、申請者と経理の責任境界へ作用する。
```

## まとめ

```text
Activity は、前提を満たす世界に対して行われる。
Activity の完了によって、新しい事実が成立する。
作用は、その成立が責任境界を越えて観測可能になることである。
状態遷移は、責任ある Activity の合成として立ち上がる。
mutation は実装ビューであり、Responsible の主語彙ではない。
```
