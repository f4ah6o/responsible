# semantic core を実践実装向けに明文化する

Status: open
Model: unknown
Created: 2026-06-24
Updated: 2026-06-24
Branch: docs/2-document-semantic-core
Source:
- https://github.com/f4ah6o/responsible/issues/2

## 概要

`responsible` の reference implementation と今後の可視化・検証実装を支えるため、理論的背景を実装可能な設計規則として整理する。
対象は `docs/semantic-core.md`、`docs/theory.md`、README、既存の `docs/research-report.md` の整理である。

## 背景

`docs/research-report.md` は `responsible` を BPMN runtime ではなく、責任境界付き Activity を中心にした semantic core として位置づけている。
現状の調査報告は理論ファミリの棚卸しとして有用だが、実践実装の根拠にするには、理論名の列挙から一段進めて core model、projection、adapter、verification に落ちる意味論を明文化する必要がある。

README や docs では、次の誤読を避ける必要がある。

- BPMN 互換 runtime を作っているように見える。
- RACI または swimlane 図の可視化ツールに見える。
- Event Sourcing、Actor runtime、State Machine runtime の一種に見える。
- `requires`、`ensures`、`effects` が単なる説明文に見える。
- RBNF が未定義のまま正規形を名乗っているように見える。
- Hoare Logic、Design by Contract、Petri Net などを実装不能な約束として掲げているように見える。

先に確定すべき設計判断は次の2点である。

- Activity は純粋な `Input -> Output` ではなく、`World` と `Effect[]` を扱う effectful computation として定義する。
- v0 の `requires` / `ensures` は opaque runtime predicate とし、静的な含意判定は symbolic predicate AST / DSL 導入後の future work とする。

## 問題

理論的背景が実装判断へ十分に接続されていないため、何を型にするか、何を invariant として assert するか、何を projection として実装するか、何を runtime checking に留めるか、何を future static verification に回すかが文書から判断しにくい。
RBNF も、normal form、projection、quotient のどれとして扱うか、および同値関係、情報保存性、v0 実装範囲が明文化されていない。

## 目標

`responsible` の semantic core を、実装者が型、不変条件、合成規則、projection、RBNF、検証対象へ落とせる設計規則として文書化する。
理論文書は、理論調査を増やすのではなく、既存の `docs/research-report.md` を実践実装へ接続する資料として整理する。

## 対象外

- BPMN 互換 runtime の実装。
- RACI または swimlane 図の可視化ツール化。
- Event Sourcing、Actor runtime、State Machine runtime としての実装。
- v0 での Hoare-style static verification。
- v0 での一般的な branching、merging、parallel graph の完全な weak bisimulation minimization。
- 長い理論文献リストの追加だけを目的にした調査拡張。

## 提案する方針

1. `docs/semantic-core.md` を normative 文書として追加し、型、不変条件、合成規則、projection、RBNF 定義、検証対象を記述する。
2. `docs/theory.md` を informative 文書として追加または整理し、既存理論との対応、文献、限界、採用しない理論の理由を role 単位で記述する。
3. README に短い theoretical position を追加し、`responsible` が BPMN runtime ではなく Activity-centered semantic core であることを明記する。
4. Activity を `World` と `Effect[]` を扱う effectful computation として説明し、逐次合成 `seq` を Kleisli composition として定義する。
5. `requires` / `ensures` / `effects` / `mutation` の語彙を整理し、v0 の DbC runtime checking と future の Hoare-style static verification を分ける。
6. `effects = project(ensures, boundary)` を定義し、`BoundaryProjection<In, Out>` 相当の interface で fact projection と model projection を統一する。
7. RBNF を responsibility boundary を基準にした observational equivalence による quotient view として定義する。
8. same-boundary step は `tau` / silent action、boundary-crossing effect は observable action として扱う。
9. minimized representative を選ぶ実装の場合のみ normal form と呼ぶ。
10. v0 の RBNF 実装は連続 `tau` collapse に縮退するものとして整理する。
11. Effect model を payload、delivery、visibility rules の直交軸へ分解し、mutation と分離する。
12. `INV-*` 形式で assert 可能な core invariant を列挙する。
13. verification layer を v0 と future に分け、runtime contract checking、contract chain consistency、effect / boundary consistency、projection consistency、view consistency、static contract proof、reachability、deadlock / livelock、soundness の位置づけを整理する。
14. `docs/research-report.md` に残る生成ツール由来の内部 citation token を除去する。
15. bibliography を追加する場合は、各文献がどの実装判断を支えるかを併記し、最小セットに絞る。

## 受け入れ条件

- [ ] `docs/semantic-core.md` が追加され、normative な型、不変条件、合成規則、projection、RBNF 定義、検証対象を説明している。
- [ ] `docs/theory.md` が追加または整理され、理論名ではなく role 単位で実装判断との対応を説明している。
- [ ] README を読んだ人が、`responsible` を BPMN runtime ではなく Activity-centered semantic core と理解できる。
- [ ] Activity が `Input -> Output` ではなく effectful computation として説明されている。
- [ ] Activity composition が Kleisli composition として説明され、`seq` の型が示されている。
- [ ] v0 Predicate は opaque runtime predicate であり、Hoare-style static verification は symbolic predicate AST / DSL 導入後の future work であると明記されている。
- [ ] `requires` / `ensures` / `effects` / `mutation` の語彙定義が実装向けに揃っている。
- [ ] `effects = project(ensures, boundary)` が定義されている。
- [ ] `BoundaryProjection<In, Out>` 相当の projection interface が定義されている。
- [ ] `ProcessModel -> ProcessView` が model mutation ではなく projection であることが明記されている。
- [ ] RBNF が repo 独自概念であることと、observational quotient / weak bisimulation に接地することが明記されている。
- [ ] RBNF を normal form と呼ぶ条件が明記されている。
- [ ] RBNF v0 が連続 `tau` collapse として実装できることが説明されている。
- [ ] Effect が mutation と分離され、payload、delivery、visibility rules の直交軸で説明されている。
- [ ] invariant が説明文ではなく、テスト可能な `INV-*` として書かれている。
- [ ] 線形 v0 と将来の branching、merging、parallel extension の関係が明記されている。
- [ ] verification layer が v0 と future に分けられている。
- [ ] `docs/bibliography.bib` または引用一覧を追加する場合、各文献が支える実装判断が併記されている。
- [ ] `docs/research-report.md` から内部 citation token が除去されている。
- [ ] 実装 TODO に落ちる形で型、不変条件、検証対象が整理されている。

## テスト計画

- `npm run check` を実行し、TypeScript compilation が壊れていないことを確認する。
- README、`docs/semantic-core.md`、`docs/theory.md`、`docs/research-report.md` をレビューし、BPMN runtime、RACI / swimlane visualization、Event Sourcing / Actor runtime / State Machine runtime との誤読が避けられていることを確認する。
- 文書内の `requires` / `ensures` / `effects` / `mutation`、Activity signature、`seq`、RBNF、Effect model、verification milestone の定義が受け入れ条件と対応していることを確認する。
- `rg -n "citeturn|turn[0-9]+|citation" docs README.md` などで生成ツール由来の内部 citation token が残っていないことを確認する。

## リスク

- 理論文書が実装判断ではなく理論名の列挙に戻ると、reference implementation の設計根拠として使いにくくなる。
- RBNF を quotient view、projection、normal form のどれとして扱うかが曖昧なままだと、将来の projection 実装や検証対象が揺れる。
- v0 の runtime checking と future の static verification を混同すると、実装不能な保証を docs が約束しているように見える。
- Effect と mutation を分離しない場合、responsibility boundary を越える observable result と implementation-local data change が混在する。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Document the semantic core theory, Activity effect model, RBNF definition, and v0 / future verification boundaries.

## 注記

GitHub Issue metadata:

- Source: https://github.com/f4ah6o/responsible/issues/2
- Labels: none
- GitHub createdAt: 2026-06-24T12:03:48Z
- GitHub updatedAt: 2026-06-24T12:35:36Z

GitHub close comment:

- Captured as local issue. issues/open/20260624-document-semantic-core.md
