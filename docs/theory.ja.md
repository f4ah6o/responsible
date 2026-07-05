# 理論マップ

[English](theory.md) | 日本語

この文書は説明的（informative）なものである。理論ファミリを `responsible` における実装上の判断に対応付けるものであり、v0 ですべての理論を実装することを求めるものではない。

## 実装上の役割

| 理論ファミリ                                 | `responsible` における役割                                                                                                                                                             | v0 か将来か                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| カテゴリー理論                               | Activity の合成と projection を、合成的な構造として支える。`seq` は別の Activity を返し、boundary projection は可能な限り構造を保存する view である。                                    | v0 の概念、将来の形式化            |
| Design by Contract                            | `requires`、`ensures`、そしてレビュー可能な不変条件に、実行時の意味を与える。                                                                                                              | v0 の実行時チェック                |
| Hoare Logic                                   | `ensures_A => requires_B` のような pre/post condition の連鎖を証明するための目標となる意味論を与える。                                                                                    | 将来の静的検証                     |
| Process algebra / LTS                         | RBNF のための hiding、observable action、`tau`、weak bisimulation、quotient の語彙を提供する。                                                                                            | v0 の説明、将来のグラフ検証        |
| DDD / Bounded Context                         | Responsibility Boundary をモデルおよび言語の境界として説明する助けになるが、Responsibility Boundary は Bounded Context と同一ではない。組織・役割・システム・複合的な境界軸も表現できる。 | v0 の説明                          |
| BPMN / RACI / swimlane                        | コミュニケーションと可視化の層である。view と責任割り当てを読者が理解する助けになるが、セマンティックコアではない。                                                                       | 下流の view 層                     |
| Petri Net / Workflow Net                      | v0 の線形 projection の先にある、到達可能性、健全性、分岐、合流、並列ワークフロー検証のための候補となる基盤。                                                                             | 将来の検証                         |
| Abstract Interpretation / Galois connection   | lossy な projection、抽象化、concretization の限界、view の一貫性のための候補となる基盤。                                                                                                | 将来の形式化                       |

## 支持される判断

カテゴリー理論は 2 つの中心的な判断を支える。Activity はより大きな Activity へと合成できること、そして projection は詳細な構造から view の構造への規律あるマッピングとして扱えることである。現在の実装はこれを実用的な形に保つ: plain な TypeScript の関数と JSON 互換の値である。

Design by Contract は v0 の実行時チェックを支える。`requires` と `ensures` は、opaque な関数であっても意味のある predicate である。Hoare Logic は意図的に将来の課題として分離されている。静的証明には symbolic な predicate が必要であり、callback やプレーンな文章だけでは足りないためである。

Process algebra と LTS は RBNF のための語彙を提供する。同一境界内の内部ステップは `tau` として隠され、境界を越える effect は observable action として扱われ、weak bisimulation は projection されたグラフを比較するための将来の目標を記述する。現在の v0 は線形な同一境界内の collapse のみを行う。

DDD と Bounded Context は、なぜ境界が重要なのかを説明するのに有用である。それらはモデル全体を定義するものではない。Responsibility Boundary は、person、team、role、system、company、project/function のペア、あるいはその他の選択された責任表現であり得る。

BPMN、RACI、swimlane 記法はコミュニケーションと可視化に属する。lane view は BPMN の読者にはお馴染みに見えるかもしれず、RACI は責任について議論する助けになるかもしれないが、`responsible` は BPMN の runtime でも RACI チャートツールでもない。

Petri Net と Workflow Net の理論は、モデルが線形フローを越えて成長したときにより重要になる。それらは将来の到達可能性、デッドロック / ライブロック、ワークフロー健全性チェックの候補である。

Abstract Interpretation と Galois connection の用語は、projection が意図的に lossy であるために関連が深い。projection された view は、元のモデルを再構成するのに十分な情報を含んでいなくても、一貫性があり有用であり得る。

## 参考文献

- C. A. R. Hoare, "An Axiomatic Basis for Computer Programming" (1969): pre/post condition の連鎖に関する将来の静的証明の目標を支える。https://dl.acm.org/doi/10.1145/363235.363259
- Bertrand Meyer, "Applying Design by Contract" (1992): v0 の実行時契約の語彙と不変条件の規律を支える。https://ieeexplore.ieee.org/document/161279/
- Brendan Fong and David I. Spivak, "Seven Sketches in Compositionality" (2019): 合成的なモデリングと projection の語彙を支える。https://arxiv.org/abs/1803.05316
- Robin Milner, "Communication and Concurrency" (1989): hiding、observable behavior、将来の等価性検証のための process algebra の語彙を支える。
- Martin Fowler, "Bounded Context" (2014): Responsibility Boundary との違いを保ちつつ、境界の説明を支える。https://martinfowler.com/bliki/BoundedContext.html
- Object Management Group, "Business Process Model and Notation (BPMN) Version 2.0.2" (2014): BPMN をセマンティックコアではなく、コミュニケーションと可視化の参照として扱うことを支える。https://www.omg.org/spec/BPMN/2.0.2/About-BPMN
- Wil M. P. van der Aalst, "The Application of Petri Nets to Workflow Management" (1998): 将来の Workflow Net および Petri Net 検証の方向性を支える。https://research.tue.nl/en/publications/the-application-of-petri-nets-to-workflow-management/
- Patrick Cousot and Radhia Cousot, "Abstract Interpretation: A Unified Lattice Model for Static Analysis" (1977): lossy な projection と、抽象化を通じた一貫性の将来の形式化を支える。
