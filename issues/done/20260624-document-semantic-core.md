# semantic core 文書を実装可能な設計規則として整備する

Status: done
Model: GPT-5
Created: 2026-06-24
Updated: 2026-06-24
Branch: docs/2-document-semantic-core
Source:

- https://github.com/f4ah6o/responsible/issues/2

## 概要

`responsible` の semantic core を、実装者が型、不変条件、合成規則、projection、RBNF、検証対象へ落とせる文書へ整理する。
対象は README、`docs/semantic-core.md`、`docs/theory.md`、既存の `docs/research-report.md` であり、TypeScript core の実装変更は原則として対象外とする。

## 背景

現状の README は `Activity<Input, Output>`、Activity composition、Responsibility Boundary、RBNF、Boundary projection を説明している。
`docs/activity-effects.md` と `docs/data-and-effects.md` は、`requires`、`ensures`、`effects`、`mutation` の語彙を定義している。
`docs/reference-implementation.md` は、reference implementation を dependency-free な pure TypeScript core として保ち、visualization、BPMN runtime、DSL parser、persistence、server framework を core の外に置く方針を定めている。

既存の `docs/research-report.md` は理論ファミリの棚卸しとして有用だが、実装判断の根拠にするには、理論名の列挙から一段進めて、次を明文化する必要がある。

- 何を型にするか。
- 何を invariant として assert するか。
- 何を projection として実装するか。
- 何を v0 runtime checking に留めるか。
- 何を future static verification に回すか。
- RBNF をどの意味論に接地するか。

README や docs では、次の誤読を避ける必要がある。

- BPMN 互換 runtime を作っているように見える。
- RACI または swimlane 図の可視化ツールに見える。
- Event Sourcing、Actor runtime、State Machine runtime の一種に見える。
- `requires`、`ensures`、`effects` が単なる説明文に見える。
- RBNF が未定義のまま正規形を名乗っているように見える。
- Hoare Logic、Design by Contract、Petri Net などを v0 で実装する保証として掲げているように見える。

## 問題

semantic core の normative な定義と、理論背景を説明する informative な文書が分離されていない。
そのため、reference implementation の現在の `src/model.ts`、`src/boundary.ts`、`src/normalize.ts`、`src/graph.ts` がどの意味論を実装していて、どの理論要素が future work なのかを文書から判断しにくい。

特に次の点が曖昧である。

- Activity を純粋な `Input -> Output` と見るのか、`World` と `Effect[]` を扱う effectful computation と見るのか。
- v0 の `requires` / `ensures` が opaque runtime predicate なのか、symbolic predicate AST / DSL なのか。
- `effects` が `ensures` から responsibility boundary へ射影された observable result なのか。
- RBNF が normal form、projection、quotient のどれであり、どの条件で normal form と呼べるのか。
<!-- review fix(#2): Effect の軸を文書全体で source / payload / delivery の 3 軸に統一。visibility は独立軸にせず delivery が表す。 -->
- Effect model が source を保持しつつ、payload と delivery を直交軸として分け、delivery が boundary を越える可視性規則(directed / broadcast / observable)を表すのか。
- v0 で検証する性質と、branching / merging / parallel extension 後に検証する性質の境界。

## 目標

実装者がこの issue と対象文書だけで、semantic core の文書化作業を開始し完了判定できる状態にする。
完了後は、README が project position を短く示し、`docs/semantic-core.md` が normative な設計規則を示し、`docs/theory.md` が理論と実装判断の対応を informative に示している状態にする。

## 対象外

- TypeScript core の runtime behavior 変更。
- exported API の互換性変更。
- BPMN 互換 runtime の実装。
- DSL parser、persistence layer、server framework、layout engine の追加。
- React、Vue、Svelte、canvas library、graph layout engine、schema validator、parser generator などの runtime dependency 追加。
- v0 での Hoare-style static verification。
- v0 での branching、merging、parallel graph の完全な weak bisimulation minimization。
- Event Sourcing、Actor runtime、State Machine runtime としての実装。
- 長い文献リストの追加だけを目的にした調査拡張。

## 提案する方針

1. `docs/semantic-core.md` を追加し、normative 文書として扱う。
   この文書には、Activity signature、`seq`、predicate model、projection、RBNF、Effect model、assert 可能な invariant、verification milestone を置く。
2. `docs/theory.md` を追加し、informative 文書として扱う。
   理論名ではなく role 単位で「どの実装判断を支えるか」を対応づけ、理論を v0 実装対象と future work に分ける。
3. README に短い `Theoretical position` を追加し、`responsible` が BPMN runtime ではなく Activity-centered semantic core であることを示す。
   README では詳細な理論展開を避け、`docs/semantic-core.md` と `docs/theory.md` へ誘導する。
4. `docs/research-report.md` は背景資料として残すか、`docs/theory.md` へ整理したうえで参照位置を下げる。
   どちらの場合も、生成ツール由来の内部 citation token は削除する。
5. 既存の `docs/activity-effects.md` と `docs/data-and-effects.md` の語彙は尊重する。
   語彙の重複が発生する場合は、`docs/semantic-core.md` から既存文書へリンクし、同じ概念を別定義にしない。
6. TypeScript 例は、現行 API と一致するものは current v0 と明記し、将来導入する型は future semantic target または TODO と明記する。
   現行の `src/model.ts` に存在しない型を、すでに exported API であるかのように書かない。
7. bibliography は独立した `.bib` ファイルを必須にしない。
   まずは `docs/theory.md` の references section に最小文献と、それぞれが支える実装判断を併記する。

`docs/semantic-core.md` には最低限、次を含める。

- `World` は現実世界そのものではなく、`responsible` が扱う model world / responsibility state であること。
- Activity は effectful computation として読めること。

```ts
type Activity<I, O> = (world: World, input: I) => ActivityResult<O>;

type ActivityResult<O> = {
  world: World;
  output: O;
  effects: Effect[];
};
```

- 逐次合成は通常の関数合成ではなく、world と effects を渡す Kleisli composition として定義すること。

```ts
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

- v0 の predicate は opaque runtime predicate であり、`ensures_A => requires_B` の静的判定はできないこと。

```ts
type ContractResult = { ok: true } | { ok: false; reason: string };

type Requires<I> = (world: World, input: I) => ContractResult;
type Ensures<O> = (world: World, output: O) => ContractResult;
```

- `requires` は Activity 実行前の前提、`ensures` は Activity 完了後に model world で成立する事実、`effects` は `ensures` のうち responsibility boundary を越えて観測可能になる projection、`mutation` は implementation-local data change であること。
- `effects = project(ensures, boundary)` を定義すること。
- fact projection と model projection を、同じ projection 概念の別インスタンスとして説明すること。

```ts
interface BoundaryProjection<In, Out> {
  project(input: In, boundary: BoundaryId): Out;
}
```

- RBNF は primary には responsibility boundary を基準にした observational equivalence による quotient view であり、selected boundary への projection でもあること。
- same-boundary internal step は `tau` / silent action、boundary-crossing effect は observable action として扱うこと。
- minimized representative を選ぶ場合のみ normal form と呼ぶこと。
- v0 の linear projection では、一般の weak bisimulation minimization ではなく、連続 `tau` collapse に縮退すること。
- RBNF は非可逆であり、復元 API を提供しないこと。
<!-- review fix(#2): delivery が boundary を越える可視性規則を兼ねることを明記し、L200 受け入れ条件と軸数を一致させる。 -->
- Effect model を最低限、`source`、`payload`、`delivery` に分け、`delivery` が boundary を越える可視性規則(directed / broadcast / observable)を表すこと。

```ts
type Effect = {
  source: {
    activityId: ActivityId;
    boundary: BoundaryId;
  };
  payload:
    | { kind: "domain-fact"; schema: SchemaRef }
    | { kind: "command"; schema: SchemaRef }
    | { kind: "data"; schema: SchemaRef };
  delivery: // boundary-crossing visibility rule
    { mode: "directed"; target: BoundaryId } | { mode: "broadcast" } | { mode: "observable" };
};
```

- `INV-*` として、少なくとも次の invariant を列挙すること。
  `INV-1`: view projection は model を mutation しない。
  `INV-2`: mutation は Activity 実行中の world update に閉じる。
  `INV-3`: directed effect は既知の source / target boundary を持つ。
  `INV-4`: boundary projection は leaf Activity 基準で行う。
  `INV-5`: RBNF collapse は非可逆である。
  `INV-6`: Activity composition は Activity を返す。
- verification layer を v0 と future に分けること。
  v0 には runtime contract checking、contract chain consistency、effect / boundary consistency、projection consistency、view consistency を置く。
  future には symbolic predicate AST / DSL による static contract proof、branching graph の reachability、deadlock / livelock、workflow soundness を置く。

`docs/theory.md` には最低限、次を含める。

- Category theory は semantic core と projection の両方に関係すること。
- Design by Contract は v0 runtime checking、Hoare Logic は future static verification に主に関係すること。
- Process algebra / LTS は hiding、observable action、weak bisimulation、future verification に関係すること。
- DDD / Bounded Context は Responsibility Boundary の説明に関係するが、同一概念ではないこと。
- BPMN、RACI、swimlane は communication / visualization layer であり、semantic core ではないこと。
- Petri Net / Workflow Net は branching、merging、parallel extension 後に強くなる future verification の候補であること。
- Abstract Interpretation / Galois connection は lossy projection と view consistency の理論候補であること。
- 各文献は、単なる参考文献ではなく、どの実装判断を支えるかと一緒に記載すること。

## 受け入れ条件

- [ ] Given the updated README, when a reader looks for the project position, then it says `responsible` is an Activity-centered semantic core and not a BPMN runtime, RACI chart tool, Event Sourcing runtime, Actor runtime, or State Machine runtime.
- [ ] Given `docs/semantic-core.md`, when an implementer reads the Activity section, then Activity is described as an effectful computation over `World`, `input`, `output`, and `Effect[]`.
- [ ] Given `docs/semantic-core.md`, when an implementer reads the composition section, then `seq` is shown as Kleisli composition and returns another Activity.
- [ ] Given `docs/semantic-core.md`, when an implementer reads the predicate section, then v0 predicates are opaque runtime predicates and Hoare-style static verification is explicitly future work.
<!-- review fix(#4): 最重要リスク(未実装の擬似型を current API と誤読)を機械/レビューで担保する受け入れ条件を追加。 -->
- [ ] Given `docs/semantic-core.md`, when an implementer reads any TypeScript block using `World`, `ActivityResult`, or `Effect`, then it is explicitly marked as a future semantic target or TODO and not presented as current exported API in `src/model.ts`.
- [ ] Given `docs/semantic-core.md`, when an implementer reads the vocabulary section, then `requires`, `ensures`, `effects`, and `mutation` match the meanings already used in `docs/activity-effects.md` and `docs/data-and-effects.md`.
- [ ] Given `docs/semantic-core.md`, when an implementer reads the projection section, then `effects = project(ensures, boundary)` and `ProcessModel -> ProcessView` are both described as boundary projections, and projection is not model mutation.
- [ ] Given `docs/semantic-core.md`, when an implementer reads the RBNF section, then RBNF is defined as a quotient view up to boundary-crossing observational equivalence, with v0 reduced to continuous `tau` collapse.
- [ ] Given `docs/semantic-core.md`, when an implementer reads the RBNF section, then the document states that normal form terminology applies only when a minimized representative is selected.
<!-- review fix(#2): visibility を独立軸とする記述を撤回し、delivery が可視性規則を担う 3 軸構成に統一(L51 / L149 / TS 骨子と一致)。 -->
- [ ] Given `docs/semantic-core.md`, when an implementer reads the Effect model section, then Effect is separated from mutation and split into source, payload, and delivery concerns, where delivery expresses the boundary-crossing visibility rule.
- [ ] Given `docs/semantic-core.md`, when a reviewer inspects invariants, then each `INV-*` item is phrased as an assertable or reviewable condition.
- [ ] Given `docs/semantic-core.md`, when a reviewer inspects verification milestones, then v0 checks and future verification topics are separated.
- [ ] Given `docs/theory.md`, when a reviewer inspects theory mapping, then each theory is mapped to roles or implementation decisions rather than listed as an undifferentiated layer.
- [ ] Given `docs/theory.md`, when a reviewer inspects references, then each citation explains which implementation decision it supports.
<!-- review fix(#1,#3): クォート直後に混入していた不可視文字 U+E200 を除去し、英単語 "citation" を誤検出する `|citation` を削除。生成 token (citeturn / turn\d+view / turn\d+search) のみを拾う。 -->
- [ ] Given `docs/research-report.md`, README, and new docs, when `rg -n 'citeturn|turn[0-9]+(view|search)' docs README.md` is run, then no generated citation token remains.
- [ ] Given the updated docs, when a reviewer searches for new runtime dependencies, then `package.json` has no new runtime dependencies caused by this issue.
- [ ] Given the updated docs, when `pnpm run check` is run in the repository, then it exits successfully.

## テスト計画

- Run `pnpm run check`.
- Run `git diff --check`.
<!-- review fix(#1,#3): 受け入れ条件と同じく、不可視文字 U+E200 を除去し `|citation` を削除した検証コマンドに修正。 -->
- Run `rg -n 'citeturn|turn[0-9]+(view|search)' docs README.md` and confirm no generated citation token remains.
- Run `rg -n 'BPMN runtime|RACI|swimlane|Event Sourcing|Actor runtime|State Machine runtime' README.md docs/semantic-core.md docs/theory.md` and manually confirm the terms are used to prevent misclassification, not to claim those runtimes are implemented.
- Run `rg -n 'World|ActivityResult|Kleisli|BoundaryProjection|observational|weak bisimulation|tau|INV-' docs/semantic-core.md` and confirm each required semantic concept is present.
- Run `rg -n 'Design by Contract|Hoare|Category|Process algebra|LTS|Bounded Context|BPMN|RACI|Petri|Workflow Net|Abstract Interpretation' docs/theory.md` and confirm each role mapping is present.
- Manually review README, `docs/semantic-core.md`, `docs/theory.md`, `docs/activity-effects.md`, `docs/data-and-effects.md`, and `docs/reference-implementation.md` for terminology consistency.
- No unit tests are required for this issue unless implementation code is changed. If code is changed, add or update tests in the related test issue scope instead of expanding this documentation issue.

## リスク

- If `docs/semantic-core.md` presents future pseudo-types as current exported API, readers may assume runtime capabilities that do not exist.
- If `docs/theory.md` remains a theory catalog, it will not help implementers decide what to type, project, assert, or defer.
- If v0 runtime checking and future static verification are mixed, docs may imply guarantees that the current implementation cannot provide.
- If RBNF is described only as a UI collapse, future graph quotient and verification work will lack a stable semantic target.
- If Effect and mutation are not separated, observable cross-boundary results may be confused with implementation-local data changes.
- If generated citation tokens remain, the docs will be unsuitable as repository documentation.

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Document the semantic core theory, Activity effect model, RBNF definition, and v0 / future verification boundaries.

## 注記

Implementation plan and progress:

- [x] Move issue to `issues/doing` and use it as the live handoff/progress artifact.
- [x] Add normative semantic core documentation in `docs/semantic-core.md`.
- [x] Add informative theory mapping in `docs/theory.md`.
- [x] Update README project positioning and links.
- [x] Clean generated citation tokens from `docs/research-report.md`.
- [x] Add `CHANGES.md` entry for the documentation change.
- [x] Run acceptance checks and record results.
- [x] Move this issue to `done` when all acceptance criteria are met.

Classification:

- Work type: documentation / semantic specification.
- Urgency: normal.
- User-visible impact: repository readers and future implementers get clearer semantics and non-goals.
- Expected branch: `docs/2-document-semantic-core`.
- Primary files: README, `docs/semantic-core.md`, `docs/theory.md`, `docs/research-report.md`.
- Consistency references: `docs/activity-effects.md`, `docs/data-and-effects.md`, `docs/reference-implementation.md`, `src/model.ts`, `src/boundary.ts`, `src/normalize.ts`, `src/graph.ts`.
- Related local issue: `issues/open/20260624-add-reference-implementation-tests.md`; complementary test work, not a duplicate.

GitHub Issue metadata:

- Source: https://github.com/f4ah6o/responsible/issues/2
- Labels: none
- GitHub createdAt: 2026-06-24T12:03:48Z
- GitHub updatedAt: 2026-06-24T12:35:36Z

State transition:

- Previous path: `issues/open/20260624-document-semantic-core.md`
- Current path: `issues/done/20260624-document-semantic-core.md`
- Reason: scope, constraints, acceptance criteria, and verification plan are specific enough to begin implementation.
- Unresolved questions: none blocking implementation.

GitHub close comment:

- Captured as local issue. issues/open/20260624-document-semantic-core.md
- 2026-06-24: Implementation started; plan saved in doing as live handoff/progress artifact.
- 2026-06-24: Verification passed: `pnpm run check`, `git diff --check`, generated citation-token search, project-position search, semantic-core concept search, theory mapping search, and current-issue validation.
- 2026-06-24: Repository-wide issue validation still reports pre-existing formatting problems in `issues/open/20260624-add-reference-implementation-tests.md`; the current issue validates cleanly.
- 2026-06-24: Implemented semantic-core documentation, theory mapping, README positioning, research citation cleanup, CHANGES entry, and verification checks.
