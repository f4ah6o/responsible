# responsible の理論的・実践的基盤に関する調査報告

[English](research-report.md) | 日本語

> Note: This file is retained as background research. The normative semantic rules are in `docs/semantic-core.md`, and the curated implementation-oriented theory mapping is in `docs/theory.md`.

## エグゼクティブサマリー

`responsible` は、BPMN そのものを中心に置くのではなく、`Activity<Input, Output>` の合成を中心に業務プロセスを記述するモデリング系である。
責任属性と責任境界は Activity に付与され、lane や swimlane に近い view は後から投影される。
README と公開ドキュメントでは、Activity を typed function と見なし、`requires` を開始前提、`ensures` を成立事実、`effects` を責任境界を越えて観測可能になる結果として説明している。
状態遷移は最初から主語になるのではなく、Activity の並びから導出される。
初期実装は pure function と plain object を重視し、`ProcessModel -> ProcessView`、Activity 分解 zoom、責任境界 zoom、Responsibility Boundary Normal Form 投影、lane 表示を外部 view として扱う。
現時点の v0 は線形フローに限定されている。

この設計を支える理論的な背骨は、型付き関数型プログラミング、カテゴリー理論の合成、Hoare Logic と Design by Contract、DDD の Bounded Context、Petri Net と Workflow Net である。
型付き関数型プログラミングとカテゴリー理論は、`Activity<Input, Output>`、合成、内部中間型の隠蔽、view への射影という発想を支える。
Hoare Logic と Design by Contract は、`requires` と `ensures` の意味論を支える。
DDD は Responsibility Boundary に組織的な意味付けを与える。
Petri Net と Workflow Net は、構文記述を越えた健全性、到達性、検証可能性の足場になる。

ただし、`responsible` のすべてが既存文献にそのまま対応するわけではない。
「Responsibility Boundary Normal Form」「境界相対的な Effect」「mutation ではなく成立事実を主語にする最小語彙」は、複数理論を接合した repo 独自の統合提案として扱うのが正確である。
近縁理論は存在するが、同一の定式化は現時点で見当たらない。
README では、「既存理論で裏づけ可能な部分」と「repo 独自仮説」の境界を明記する必要がある。

実務導入の説明には、BPMN、swimlane、EventStorming、RACI、IDEF0、DEMO と LAP、Activity Theory、Systems Thinking が使える。
BPMN や RACI だけでは、形式検証や意味論の核としては弱い。
一方で、Petri Net や Hoare Logic だけでは、現場説明性が不足しやすい。
repo に登録する説明としては、説明層に BPMN、EventStorming、RACI を置き、意味論層に typed FP、Design by Contract、DDD を置き、検証層に Petri Net、Workflow Net、LTS を置く三層構成が安定する。

## リポジトリから確認できる responsible の設計仮説

公開されている README、`docs/activity-effects.md`、`docs/data-and-effects.md`、`docs/reference-implementation.md` から確認できる範囲では、`responsible` の中心は「すべては Activity」という立場である。
Activity は `Input -> Output` の typed function として読まれる。
親 Activity は子 Activity の合成として扱われる。
Start と End は view の境界である。
Trigger は外部または未展開 Activity の output である。
Gateway や分岐判定も Activity として扱われる。
この方針によって、内部モデルから特別記号をできるだけ排除している。

同時に、repo は「データが自分で変化する」のではなく「Activity が Data を変化させる」と説明している。
`Mutation` は内部変化である。
`Effect` は責任境界を越えて観測可能になる結果である。
同じ出来事は、zoom level によって内部 mutation にも外部 effect にもなりうる。
そのため、Effect は絶対概念ではなく boundary-relative な概念である。
この設計は、通常の CRUD 記述や単純な event-log 記述よりも、責任、観測、公開可能性に重心を置く。

実装方針でもこの立場は一貫している。
公開ドキュメントは core runtime dependencies を 0 とし、純粋関数と JSON 直列化可能な plain data structure を外部 API とする。
view は `ProcessModel -> ProcessView` として downstream に置かれる。
Activity decomposition zoom と Responsibility boundary zoom は独立軸である。
Boundary projection は leaf Activity を対象にし、same-boundary run を collapse して lane 上に表示する。
現時点の v0 は線形フローのみを対象にし、分岐、合流、並列は将来の graph quotient projection に委ねている。

現段階の `responsible` は、「責任境界に敏感な typed activity algebra と、その投影 view のための最小実装」と位置づけられる。
BPMN runtime、永続化、DSL parser、layout engine、server framework は、意図的に core の外に置かれている。
理論説明では、「これは BPMN 代替 runtime ではなく、Activity 中心の semantic core である」と明示すると誤読を減らせる。

## 理論ファミリ別マッピング

### 型付き関数型プログラミング

`Activity<Input, Output>`、親 Activity を子 Activity の合成として扱う方針、内部中間型の隠蔽は、typed FP の基礎語彙に乗る。
README 自体が `Activity<Input, Output>` と関数合成 `Process = C ∘ B ∘ A` を掲げている。
公開ドキュメントも `Activity : World -> (World, Effect[])` に近い読みを与えている。
代表文献としては Haskell の標準報告、Backus の functional style、Hughes の modularity 論文が適切である。
実装例としては Haskell、Scala、Arrow-kt のような型付き関数合成系が近い。
repo へ入れる引用候補は、`Marlow et al., Haskell 2010 Language Report`、`Backus 1978`、`Hughes 1989` である。

### カテゴリー理論と compositionality

`responsible` の「活動を並べるとより大きな活動が立ち上がる」という発想は、射の合成と結合律を中心に置くカテゴリー理論と整合する。
内部中間型を外から隠したまま大きな Activity として観る発想は、morphism の合成と抽象化に近い。
代表文献としては Eilenberg と Mac Lane の創始論文、Mac Lane の標準教科書、Fong と Spivak の applied category theory が妥当である。
実装と実践の補助線としては、Haskell の `Category` と `Arrow` 抽象、Context Mapper のような高水準 DSL が近い。
repo 引用候補は、`Eilenberg and Mac Lane 1945`、`Mac Lane 1978`、`Fong and Spivak 2019` である。

### Design by Contract と Hoare Logic

`requires` と `ensures` は、Hoare triple と Design by Contract に直接対応する。
Hoare Logic はプログラム前後条件の証明基盤を与える。
Meyer の Design by Contract は、その基盤を現場で読める契約として、前提、事後保証、不変条件に落とし込んだ。
`responsible` における `requires` は「開始してよい世界の条件」である。
`ensures` は「完了後に成立する事実」である。
この二つは、precondition と postcondition の言い換えとして扱える。
実装例は Eiffel、JML と OpenJML、SPARK と Ada である。
repo 引用候補は、`Hoare 1969`、`Meyer 1992`、`Cok et al. / OpenJML` である。

### DDD と Bounded Context

Responsibility Boundary は、単なる組織図ではない。
どの model、language、rule が有効かを切る境界として読むと、DDD の Bounded Context とよく対応する。
Evans の定義では、bounded context は特定モデルが定義され、適用される境界である。
repo でも responsibility は person、team、role、system といった属性を Activity に付与する形で扱われている。
`responsible` の boundary は DDD の bounded context より広く、組織責任と表示投影も含む。
ただし、理論的な最短距離は DDD である。
実装例は Context Mapper、Context Mapping、Axon の DDD と CQRS 支援である。
repo 引用候補は、`Evans 2003/2015`、`Fowler 2014 Bounded Context`、`Kapferer et al. 2020 Context Mapper` である。

### Actor Model と Process Algebra

Effect を「境界を越えて観測可能になる結果」とみなす発想は、actor 間メッセージ送信や process algebra の相互作用記述と相性がよい。
Actor Model は、独立した主体が message passing で連携する計算モデルを与える。
CSP と CCS は、通信、同期、隠蔽、観測可能挙動を扱う。
`responsible` の boundary crossing effect は、内部 mutation ではなく対外相互作用を主語にする点で actor と process の見方に近い。
実装例は Akka、Akka.NET、XState の actor 模式である。
repo 引用候補は、`Hewitt, Bishop, Steiger 1973`、`Hoare 1985 / 1984`、`Milner 1989` である。

### Labeled Transition Systems と State Machines

repo は「状態遷移を直接主語にしない。
Activity の合成として状態遷移が立ち上がる」と述べる。
この立場は state machine を否定しない。
State transition を二次的で導出的な view とみなす立場である。
LTS、statechart、SCXML は derived view や execution view として使える。
Harel statecharts は階層化、並行性、可視化を与える。
実装例は XState、SCXML、itemis CREATE である。
repo 引用候補は、`Harel 1987`、`W3C SCXML 2015`、`itemis CREATE docs` である。

### Event Sourcing と EventStorming

`responsible` が mutation ではなく「成立した事実」とその effect を書く点は、Event Sourcing と親和する。
Event Sourcing は状態変更を event の系列として保存し、過去状態再構成や履歴追跡を可能にする。
EventStorming は、複雑な業務領域を event 中心に共同探索する workshop 形式である。
プロセス発見や bounded context 候補の抽出に向く。
`responsible` は Event Sourcing そのものではない。
ただし、`ensures` を domain fact、`effects` を observable publication として扱うと接続しやすい。
実装例は EventStoreDB、Axon Framework、Temporal である。
repo 引用候補は、`Fowler 2005`、`Brandolini 2013- / official book`、`Overeem et al. 2021 lessons from industry` である。

### Petri Nets と Workflow Nets

`responsible` に形式検証の足場を与える理論は Petri Net と Workflow Net である。
Petri Net は並行、同期、到達可能性を扱う。
Workflow Net は業務フローの soundness を扱う。
repo の v0 は線形フローだが、将来の branching、merging、parallel activities に進むなら、Workflow Net との往復が理論的に有力である。
実装例は ProM、WoPeD、workflow-net analyzers である。
repo 引用候補は、`Petri 1962`、`van der Aalst 1998`、`van der Aalst et al. 2011` である。

### BPMN と lane / swimlane

repo は BPMN 互換 runtime を目指していない。
ただし、lane と swimlane に近い表示は明確に志向している。
BPMN は stakeholder が直接読め、software process component に翻訳可能な de facto standard と OMG が位置付けている。
そのため、`responsible` の view 層に BPMN 的 lane 表示を与えるのは自然である。
ただし、BPMN は意味論の核ではなく、可視化と共有言語の層として使うのがよい。
実装例は Camunda Modeler、bpmn-js 系、Signavio 系である。
repo 引用候補は、`OMG BPMN 2.0.2`、`White / Wohed et al.`、`Camunda BPMN docs` である。

### RACI

Responsibility Boundary の導入説明には RACI が有効である。
RACI はタスクや成果物に対する Responsible、Accountable、Consulted、Informed を整理する責任割当表である。
責務の見える化には強い。
ただし、型、合成、検証、状態導出は与えない。
そのため、`responsible` の meaning layer ではなく、communication と governance の補助として位置づけるべきである。
実務例は PMI の責任割当行列、各種 project management tool の RACI chart である。
repo 引用候補は、`PMI Responsibility Assignment Matrix`、`Smith and Erwin RACI`、`PMBOK RAM references` である。

### IDEF0

IDEF0 は、機能を input、control、output、mechanism で表す関数モデリング標準である。
`Activity<Input, Output>`、責任、参照ルール、観測対象を整理する補助手段として有効である。
`responsible` の `requires` は IDEF0 の control に近い。
input と output は、そのまま入出力に近い。
responsibility は mechanism に近い。
ただし、IDEF0 は合成意味論や境界越え effect を十分には表現しない。
実装例は IDEF0 対応 EA ツールやモデリングソフトである。
repo 引用候補は、`FIPS PUB 183`、`ICAM IDEF0`、`IDEF0 tool conformance docs` である。

### Activity Theory

repo が「世界の変化を活動中心に書く」とする点は、Activity Theory と対応する。
主体、道具、対象、共同体、分業、ルールという mediated activity の見方は、責任境界、役割、system attribute、organizational view を説明できる。
ただし、Activity Theory は形式仕様よりも、組織変革、学習、矛盾分析に強い。
実践例は Change Laboratory、発達的活動研究、教育、医療、業務改善の介入である。
repo 引用候補は、`Engeström 1987`、`Engeström 2001`、`Virkkunen and Newnham 2013 / Change Laboratory` である。

### DEMO と LAP

責任ある主体が約束、依頼、受諾、履行を通じて事実を成立させるという見方は、DEMO と Language-Action Perspective に近い。
DEMO は organisation の本質を、人間同士の commitment と authority、responsibility、competence の連鎖として捉える。
`responsible` の `ensures` を「成立事実」、`effects` を「他境界で観測可能になる結果」と読むと、DEMO transaction pattern と接続しやすい。
実装と実践の例は DEMOworld、Enterprise Engineering Institute の DEMO tooling、LAP 系 communication modelling である。
repo 引用候補は、`Dietz 1999/2006/2024`、`Winograd and Flores 1987`、`Schoop 2001` である。

### Systems Theory と Cybernetics

boundary、feedback、observation、control を重視する `responsible` には、systems theory と cybernetics も基底説明として使える。
Bertalanffy は、相互作用する部分からなる system を主題化した。
Wiener は、control and communication を主題化した。
`responsible` で responsibility boundary を切り、effect を観測可能性で定義し、view を zoom と projection で切り替える発想は、システム境界、フィードバック、制御という語彙で説明できる。
実務例は Vensim、STELLA、systems thinking ツール群である。
repo 引用候補は、`von Bertalanffy 1968`、`Wiener 1948`、`Vensim / STELLA systems thinking docs` である。

### projection / view / Responsibility Boundary Normal Form

この部分は repo 独自性が強く、既存文献との一致は部分的である。
repo ドキュメントは、leaf Activity を selected boundary で投影し、same-boundary run を collapse した graph を lane に表示すると述べている。
近い理論は、カテゴリー理論の abstraction と compositional view、process algebra の hiding と abstraction、workflow graph quotienting である。
ただし、「Responsibility Boundary Normal Form」という定式名そのものは repo 固有とみなすべきである。
README では、この点を「既存理論から着想を受けた新規命名」と明記するのが学術的に誠実である。

## 実証研究から見える有効性と限界

business process modeling については、経験研究が厚い。
7PMG は process model comprehension に関する実証研究を統合し、「同じ振る舞いでもより理解しやすいモデルに変形できる」という前提で、理解しやすさを高める指針を提示している。
Systematic literature review では、business process modeling quality 研究の多くが understandability と readability に集中していると整理されている。
同じ review では、経験研究で BPMN と EPC がよく使われる一方、包括的で合意済みの quality framework はまだ不足しているとも述べられている。
この結果から、`responsible` は、まず理解しやすさを改善する説明モデルとして価値を出し、その後に形式化を足す導入順が妥当だと考えられる。

BPMN には、OMG による標準化と広い実務普及がある。
ただし研究側では、BPMN は「何でもきれいに表せる万能形式」とは見なされていない。
Workflow Patterns に照らした suitability 評価では、BPMN の適用可能性と限界の両方が議論されている。
読みやすさの研究でも、表現の豊富さが常に理解容易性に直結するわけではない。
そのため、`responsible` のように semantic core を単純化し、BPMN を主として view 層に退避する方針は、経験研究の知見と整合する。

Event Sourcing には実務利点と実務負債の両方がある。
Fowler の説明どおり、全変更履歴を event として保存すると、過去状態の再構成や retroactive handling が可能になる。
一方で、産業ケースの調査では、schema evolution、学習コスト、技術不足、projection 再構築、data privacy が継続的課題として挙がっている。
そのため、`responsible` が Event Sourcing を採り込むとしても、「成立事実」や `Effect` をそのまま event store に写像すれば終わるわけではない。
Schema evolution と projection lifecycle を明記する必要がある。

契約ベース仕様にも、理論と実装のあいだにギャップがある。
Design by Contract は前提と事後条件の意味論として強い。
ただし経験研究では、「開発者が実際にどの程度 contract を書くか」「どの contract を書けるのに書いていないか」「静的検証と runtime assertion checking をどう併用するか」が問題になる。
`responsible` に `requires` と `ensures` を導入する際も、すべてを完全形式化するより、まず簡潔な事実記述、責任記述、代表的不変条件から始めるほうが現実的である。

Actor model や state machine の産業利用は豊富である。
ここでの論点は、`responsible` の置き場所である。
Akka や XState は、concurrency、orchestration、execution semantics を提供する実行基盤として強い。
しかし repo の reference implementation policy は、core を boring な pure model に保ち、runtime や UI を外部 adapter に任せると述べている。
そのため、actor runtime や state machine runtime は、`responsible` の核そのものではない。
これらは投影先または実行先としての downstream implementation として整理するのが正しい。

## 比較表

次表は、repo の公開テキスト、各理論の原典、標準、公式資料、利用実態やモデリング品質に関する経験研究をもとに要約したものである。
理論の成熟度は、学術的成熟度と実務定着度の両方を勘案している。

| 理論                          | 核心アイデア                       | responsible への対応                                        | 成熟度                         | 推奨用途                                  | repo-ready citation strings                                                                                                                                                                    |
| ----------------------------- | ---------------------------------- | ----------------------------------------------------------- | ------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typed FP                      | 型付き関数と合成                   | `Activity<Input,Output>`、親子合成、内部中間型の隠蔽        | mature                         | explanatory / internal semantics          | `Marlow et al. Haskell 2010 Language Report (2010)`; `Backus, Can Programming Be Liberated from the von Neumann Style? (1978)`; `Hughes, Why Functional Programming Matters (1989)`            |
| Category Theory               | 射の合成と抽象化                   | Activity 合成、projection の抽象 view、normal form の着想源 | mature                         | explanatory / formalization               | `Eilenberg & Mac Lane, General Theory of Natural Equivalences (1945)`; `Mac Lane, Categories for the Working Mathematician (1978)`; `Fong & Spivak, Seven Sketches in Compositionality (2019)` |
| Hoare Logic / DbC             | 前提と事後条件                     | `requires` / `ensures` の意味論                             | mature                         | formal verification / internal discipline | `Hoare, An Axiomatic Basis for Computer Programming (1969)`; `Meyer, Applying “Design by Contract” (1992)`; `Cok, OpenJML: Software verification for Java ... (2014)`                          |
| DDD / Bounded Context         | モデル有効範囲の境界               | Responsibility Boundary の組織・意味境界                    | mature                         | explanatory / internal architecture       | `Evans, Domain-Driven Design (2003)`; `Evans, Domain-Driven Design Reference (2015)`; `Fowler, Bounded Context (2014)`                                                                         |
| Actor Model / Process Algebra | 主体間メッセージと通信行動         | boundary crossing effect、責任主体間の相互作用              | mature                         | internal semantics / execution mapping    | `Hewitt et al., A Universal Modular ACTOR Formalism (1973)`; `Hoare, Communicating Sequential Processes (1985)`; `Milner, Communication and Concurrency (1989)`                                |
| LTS / Statecharts             | 状態遷移と観測可能な遷移           | Activity 列から導出される state transition view             | mature                         | visualization / execution / verification  | `Harel, Statecharts (1987)`; `W3C, SCXML (2015)`; `Brookes-Hoare-Roscoe, A Theory of CSP (1984)`                                                                                               |
| Event Sourcing                | 状態変化の履歴保持                 | `ensures` と成立事実、event history / projection への写像   | mature-practice / mixed-theory | internal implementation / auditability    | `Fowler, Event Sourcing (2005)`; `Overeem et al., Event Sourced Systems ... Lessons from Industry (2021)`; `Overeem et al., The Dark Side of Event Sourcing (2017)`                            |
| EventStorming                 | 共同探索ワークショップ             | domain discovery、candidate boundary 発見                   | mature-practice                | explanatory / discovery workshops         | `Brandolini, Introducing EventStorming (official book)`; `EventStorming official site`; `Brandolini, EventStorming Process Modelling template`                                                 |
| Petri Nets / Workflow Nets    | 並行性・同期・健全性検証           | branching / merging / parallel の厳密化、soundness          | mature                         | formal verification                       | `Petri, Kommunikation mit Automaten (1962)`; `van der Aalst, The Application of Petri Nets to Workflow Management (1998)`; `van der Aalst et al., Soundness of Workflow Nets (2011)`           |
| BPMN / Swimlane               | 利害関係者向け標準記法             | lane / swimlane view、説明図                                | mature                         | visualization / communication             | `OMG, BPMN 2.0.2 (2014)`; `Wohed et al., On the Suitability of BPMN for Business Process Modelling`; `Camunda BPMN docs`                                                                       |
| RACI                          | 責任割当表                         | 境界説明・責任分担の補助                                    | mature-practice                | explanatory / governance                  | `PMI, Responsibility Assignment Matrix`; `Smith & Erwin, Role & Responsibility Charting (RACI)`; `PMBOK Guide references`                                                                      |
| IDEF0                         | 機能を ICOM で記述                 | Input / Control / Output / Mechanism の補助図法             | mature                         | explanatory / documentation               | `NIST FIPS PUB 183, IDEF0 (1993)`; `ICAM IDEF0 manual`; `FIPS conformance note`                                                                                                                |
| Activity Theory               | 活動を中心に社会的実践を捉える     | Activity 主体、道具、分業、矛盾の説明                       | mature                         | explanatory / organizational analysis     | `Engeström, Learning by Expanding (1987)`; `Engeström, Expansive Learning at Work (2001)`; `Virkkunen & Newnham, The Change Laboratory (2013)`                                                 |
| DEMO / LAP                    | コミットメントと行為による組織本質 | 成立事実、依頼・受諾・履行、責任主体                        | mature in niche                | explanatory / enterprise modeling         | `Dietz, DEMO: Towards a Discipline of Organisation Engineering (1999)`; `Dietz, Enterprise Ontology (2006/2024)`; `Winograd, A language/action perspective ... (1987)`                         |
| Systems Theory / Cybernetics  | システム境界・相互作用・制御       | boundary, observation, feedback, zoom/view                  | mature                         | explanatory / systemic framing            | `von Bertalanffy, General System Theory (1968)`; `Wiener, Cybernetics (1948)`; `Systems Thinking / Vensim docs`                                                                                |

## README 追記案と mermaid 図

以下の追記案は、repo の現在の設計方針を変えずに、「既存理論に支えられている部分」と「repo 独自仮説として提示する部分」を分離するための文案である。
`Activity<Input,Output>`、`requires`、`ensures`、`effects`、責任境界、view projection、RBNF を一本の文章でつなぐ。

```md
## Theoretical position

`responsible` is an Activity-centered modeling approach.

Its semantic core is intentionally smaller than BPMN.
The model starts from typed Activities and their composition:

    Activity<Input, Output>

An Activity is not merely a data operation.
It is a responsibility-bearing unit of work performed inside a Responsibility Boundary.

This repository adopts the following distinctions:

- `requires`: facts that must already hold for an Activity to start responsibly
- `ensures`: facts that are guaranteed to hold after successful completion
- `effects`: results that become observable across a Responsibility Boundary
- `mutation`: an implementation-level internal data change caused by an Activity

In that sense, `responsible` is theoretically close to:

- typed functional composition
- Hoare logic / Design by Contract
- Domain-Driven Design and bounded contexts
- actor/message-oriented interaction models
- workflow verification traditions such as Petri nets / workflow nets

At the same time, concepts such as `Responsibility Boundary Normal Form` are currently repository-specific terms.
They are inspired by existing abstraction and projection ideas, but should be treated as an explicit proposal of this project.
```

次の短い理論マッピング表を README に置くと、読者は「これは何に近いのか」をすぐに把握できる。

```md
## Theory mapping

| responsible concept         | Closest theories                                        |
| --------------------------- | ------------------------------------------------------- |
| `Activity<Input,Output>`    | Typed FP, category-theoretic composition                |
| Activity decomposition      | functional composition, hierarchical process modeling   |
| `requires` / `ensures`      | Hoare logic, Design by Contract                         |
| Responsibility Boundary     | DDD bounded context, DEMO actor roles, RACI             |
| `effects` across boundaries | Actor model, process algebra, event-driven architecture |
| state as derived trace      | LTS, state machines, statecharts                        |
| workflow verification       | Petri nets, workflow nets                               |
| lane/swimlane view          | BPMN, responsibility-oriented visualization             |
```

repo には bibliography file を別ファイルとして分離するとよい。
最小構成として `docs/bibliography.bib` に基幹文献を置き、README からは短い引用キー参照だけを張る構成が扱いやすい。
以下は starter set である。

```bibtex
@article{Hoare1969,
  author = {C. A. R. Hoare},
  title = {An Axiomatic Basis for Computer Programming},
  journal = {Communications of the ACM},
  year = {1969},
  doi = {10.1145/363235.363259}
}

@article{Meyer1992,
  author = {Bertrand Meyer},
  title = {Applying "Design by Contract"},
  journal = {Computer},
  year = {1992},
  doi = {10.1109/2.161279}
}

@book{Evans2015,
  author = {Eric Evans},
  title = {Domain-Driven Design Reference},
  year = {2015},
  publisher = {Domain Language}
}

@article{Harel1987,
  author = {David Harel},
  title = {Statecharts: A Visual Formalism for Complex Systems},
  journal = {Science of Computer Programming},
  year = {1987},
  doi = {10.1016/0167-6423(87)90035-9}
}

@article{vanDerAalst1998,
  author = {Wil M. P. van der Aalst},
  title = {The Application of Petri Nets to Workflow Management},
  journal = {Journal of Circuits, Systems and Computers},
  year = {1998}
}

@misc{OMG_BPMN_2020_2,
  author = {{Object Management Group}},
  title = {Business Process Model and Notation (BPMN) Version 2.0.2},
  year = {2014},
  howpublished = {Formal Specification}
}

@book{MacLane1978,
  author = {Saunders Mac Lane},
  title = {Categories for the Working Mathematician},
  year = {1978},
  doi = {10.1007/978-1-4757-4721-8}
}

@book{FongSpivak2019,
  author = {Brendan Fong and David I. Spivak},
  title = {An Invitation to Applied Category Theory: Seven Sketches in Compositionality},
  year = {2019},
  publisher = {Cambridge University Press}
}
```

以下の図は、repo の設計意図を README または docs に置ける粒度でまとめたものである。
内容は公開されている README と docs の語彙に沿っている。

```mermaid
erDiagram
    ACTIVITY {
        string name
        string inputType
        string outputType
    }
    RESPONSIBILITY_BOUNDARY {
        string person
        string team
        string role
        string system
        string boundaryExpr
    }
    REQUIRES {
        string fact
    }
    ENSURES {
        string fact
    }
    MUTATION {
        string target
        string from
        string to
    }
    EFFECT {
        string observableResult
        string targetBoundary
    }
    VIEW {
        string scope
        string projectionAxis
    }

    ACTIVITY ||--o{ REQUIRES : requires
    ACTIVITY ||--o{ ENSURES : ensures
    ACTIVITY ||--o{ MUTATION : causes
    ACTIVITY ||--o{ EFFECT : emits
    ACTIVITY }o--|| RESPONSIBILITY_BOUNDARY : belongs_to
    VIEW }o--o{ ACTIVITY : projects
    EFFECT }o--|| RESPONSIBILITY_BOUNDARY : crosses_to
```

```mermaid
flowchart LR
    A[Activity A<br/>Input -> X] --> B[Activity B<br/>X -> Y]
    B --> C[Activity C<br/>Y -> Output]

    subgraph Decomposition
      A1[child A1]
      A2[child A2]
      A3[child A3]
    end

    A -. can be decomposed into .-> A1
    A1 --> A2 --> A3

    C --> P[ProcessView]
    P --> L1[Boundary projection]
    P --> L2[Activity zoom]
    L1 --> L3[Lane / Swimlane view]
```

```mermaid
flowchart TD
    S[What are you trying to do?] --> A{Explain process to stakeholders?}
    A -- Yes --> BPMN[BPMN / Swimlane / EventStorming]
    A -- No --> B{Need precise pre/post conditions?}
    B -- Yes --> DBC[Hoare Logic / Design by Contract]
    B -- No --> C{Need organizational boundary semantics?}
    C -- Yes --> DDD[DDD / Bounded Context / DEMO / RACI]
    C -- No --> D{Need concurrency or soundness analysis?}
    D -- Yes --> PETRI[Petri Nets / Workflow Nets / LTS / Statecharts]
    D -- No --> E{Need implementation guidance for event-driven systems?}
    E -- Yes --> ES[Event Sourcing / Actor Model / Temporal / Axon]
    E -- No --> FP[Typed FP / Category Theory as base semantics]
```

## 未規定事項と研究課題

最大の未規定点は、Responsibility Boundary Normal Form の厳密定義である。
公開ドキュメントからは、leaf Activity の boundary projection と same-boundary run collapse が核であることは読み取れる。
将来は branching、merging、parallel activity を graph quotient projection として扱う構想であることも読み取れる。
しかし、同値関係、正規形の一意性、情報保存性、逆写像可能性まではまだ定義されていない。
ここは literate spec として明文化したほうがよい。

第二の未規定点は、Effect の型付け水準である。
現在の docs では、`Effect` は boundary-relative な observable result とされる。
しかし、それを message 型、domain event 型、publication contract 型、observation predicate 型のどれとして扱うかで、下流実装との接続が変わる。
ここは actor model、Event Sourcing、Design by Contract のどれに寄せるかを決める必要がある。

第三の未規定点は、状態、履歴、データ変換の扱いである。
repo は mutation を implementation view に退けている。
ただし、Event Sourcing 系の実務研究が示すように、schema evolution、projection rebuild、privacy などの問題は無視できない。
`responsible` が将来 event-based implementation adapter を持つなら、`ensures` の schema change と `Effect` の versioning policy を別文書で定義する必要がある。

open research questions は次の三つに集約できる。

第一に、RBNF は「正規形」なのか、「投影 view」なのか、それとも「quotient semantics」なのか。

第二に、`Effect` は event なのか、message なのか、公開可能な成立事実なのか。

第三に、線形 v0 から分岐、合流、並列へ拡張する際、Petri Net、Workflow Net、statechart、process algebra のどの意味論を正本にするのか。

これらを明示できれば、`responsible` は「BPMN 風の可視化ツール」ではなく、「責任境界付き Activity 合成の意味論を持つモデル」として位置づけやすくなる。
