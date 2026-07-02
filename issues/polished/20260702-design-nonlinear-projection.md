# 非線形フロー（分岐・合流）の graph quotient projection を設計する

Status: polished
Model: claude-fable-5
Created: 2026-07-02
Updated: 2026-07-02
Branch: docs/20260702-design-nonlinear-projection

## 概要

v0 の linear-only 制限を解除するための前提として、分岐・合流・並行・例外経路を含む Activity Graph に対する graph quotient projection の意味論を設計し、規範文書として `docs/` に定める。本イシューは設計（調査）のみを対象とし、実装は設計結果から別イシューとして作成する。

## 背景

- `docs/reference-implementation.md` の「v0 limitation」は、v0 射影を意図的に線形フロー（`A -> B -> C -> D`）のみに限定し、分岐・合流には graph quotient projection が必要であり「linear semantics が安定した後に実装すべき」と明記している。将来項目として branching / merging / parallel activities / exception paths を挙げている。
- 現行実装は linear-only を積極的に検査しており、分岐、合流、循環、複数開始点、非連結フローを拒否するテストが `src/__tests__/` にある（`docs/reference-implementation.md` の「Assertable subset (v0)」）。拒否は `src/normalize.ts` の `linearOrder`（`src/normalize.ts:131-185`）が throw する形で実装されており、エラーメッセージ自体が「branching and merging require graph quotient projection」と本設計の必要性を明示している。
- README は Gateway（分岐・判定）と例外処理を通常の Activity（例: `Activity<Estimate, ApprovalRoute>`、`Result` 型の出力）として扱う方針を示しており、分岐は特別なノード種ではなく型付き Activity の合成で表現される。
- 規範文書は `docs/semantic-core.md` であり、不変条件 `INV-1`–`INV-6` と RBNF（Responsibility Boundary Normal Form）は現状、線形フローを前提に記述されている。

## 問題

- 同一責任境界の連続 Activity を合成する RBNF の「連続」概念が、分岐・合流を含むグラフ上で未定義である。どの部分グラフを 1 つの composite に潰すか（quotient の同値類の定義）が決まっていない。
- 分岐・合流をまたぐ合成が入力・出力型の合成規則（`Result` 型、並行時の積型など）とどう整合するかが未定義である。
- `INV-1`–`INV-6` が非線形グラフでどう拡張されるか、また lane 表示（左から右へのフロー順配置）が DAG に対してどう定義されるかが未定義である。
- この設計が確定しないまま実装イシューを作成すると、受け入れ条件が推測に基づくものになる。

## 目標

- graph quotient projection の意味論を定義した規範文書が `docs/` に存在し、後続の実装イシューがその文書だけを根拠に受け入れ条件を記述できる状態になる。

## 対象外

- 射影実装（`src/normalize.ts` ほか）の変更。
- viewer の非線形レイアウト実装。
- 実行 API（`World` / `ActivityResult` / `seq`）の設計変更。
- DSL、永続化層の設計。

## 提案する方針

1. `docs/semantic-core.md` を正典として維持し、非線形拡張を同文書への追記または `docs/` 配下の新規設計文書として起草する。配置は既存文書の構成（normative / background の区別）に従って決める。
2. 設計文書で少なくとも次を定義する。
   - 対象グラフのクラス（DAG に限定するか、循環を引き続き拒否するか）。
   - quotient の同値類: 同一責任境界の Activity をどの条件で 1 つの composite に潰すか（例: 同一境界かつ連結な部分グラフ）。
   - 合成後の入力・出力型の規則（分岐の `Result` / union 型、合流・並行の扱い）。
   - `INV-1`–`INV-6` の非線形グラフへの拡張、および必要なら追加の不変条件。
   - 表示不変条件: 射影後のグラフで隣接する composite の境界が異なること（RBNF）の非線形版。
   - v1 で表明可能な部分集合（テストで検証できる範囲）と、実装を先送りする範囲の線引き。
3. 各サンプルプロセス相当の小さな分岐・合流例を文書内に含め、期待される射影結果を手計算で示す。
4. 設計確定後、実装イシュー（core 射影の拡張、viewer レイアウトの拡張）を設計文書を根拠に別途作成する。

## 受け入れ条件

- [ ] graph quotient projection の設計文書が `docs/` に存在し、対象グラフのクラス、quotient の同値類、型合成規則、不変条件の拡張、v1 の表明可能な部分集合を定義している。
- [ ] 分岐・合流を含む具体例と、その期待射影結果（各責任境界レベル）が文書に含まれている。
- [ ] 既存の `docs/semantic-core.md`・`docs/reference-implementation.md`・README の記述と矛盾しないこと、または矛盾箇所の改訂が文書内で明示されている。
- [ ] 後続の実装イシューを作成できる粒度で、実装対象（core / viewer）ごとのスコープ候補が列挙されている。

## テスト計画

- レビューで、文書内の具体例の期待射影結果を手計算で再検証する。
- 文書が定義する不変条件が、既存の線形ケースでは現行 `INV-1`–`INV-6` と同じ結論を与えること（後方互換）をレビューで確認する。
- `pnpm run check` で文書追加後も format / lint が通ることを確認する。

## リスク

- quotient の同値類の定義次第で、既存の線形射影の結果が変わりうる。線形ケースを不変に保つ制約を設計の前提に置くかどうかを文書で明示する必要がある。
- 型合成規則（特に並行の積型）は `responsible.v0` スキーマの拡張を要求する可能性があり、スキーマバージョン更新（`responsible.v1`）の要否判断が設計に含まれる。
- 設計が大きくなりすぎる場合、branching / merging を先行し parallel / exception paths を後続文書に分割する判断が必要になる。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Document the graph quotient projection design for non-linear flows (branching / merging), including the extended invariants and the v1 assertable subset. (`issues/open/20260702-design-nonlinear-projection.md`)

## 注記

- 本イシューは調査・設計のみで完結する。実装イシューの受け入れ条件を先に固定しないこと（`create-issue` の分割規則に従う）。
- 2026-07-02: polish-issue: 品質基準を満たしたため polished へ遷移
