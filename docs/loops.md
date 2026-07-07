# Loop semantics

English | [日本語](loops.ja.md)

This document is normative for the projection and rendering of Activity graphs that contain cycles (loops): rework, resubmission, and review round-trips. It extends the DAG quotient projection defined in [`docs/nonlinear-projection.md`](nonlinear-projection.md); where this document and [`docs/semantic-core.md`](semantic-core.md) disagree, `semantic-core.md` wins on core semantics and this document wins on loop projection.

Status: **design settled, implementation staged** (see the [staged plan](#staged-plan)). Until stage 1 lands, `projectDagByResponsibilityBoundary` (`src/quotient.ts`) keeps rejecting cycles with an explicit error.

## Goals

- Define the projection `project` and the Responsibility Boundary Normal Form (RBNF) extension for a finite `ActivityGraph` that may contain cycles.
- Show that invariants `INV-1`–`INV-8` still hold (or how they are reformulated) when loops exist, and add the loop-specific invariants `INV-9` / `INV-10`.
- Fix the viewer rendering policy: how return edges are drawn, and how a loop appears and disappears under boundary zoom.
- Decide the schema impact: loops are handled on unchanged `responsible.v0` / `responsible.v1` documents; no `responsible.v2` is needed.

## Non-goals

- **No execution semantics.** How many times a loop iterates, its termination condition, retry limits, or timeout policy are runtime concerns; an execution API is a README non-goal. This document only defines how the _structure_ of iteration is projected and drawn.
- **No model schema change.** Like DAG projection, loop projection is a projection capability over the data (see [Schema impact](#schema-impact)).
- **No change to the v0 linear projector.** `projectByResponsibilityBoundary` stays the stricter linear special case and keeps rejecting cycles.

## Design summary

A loop is a directed cycle in the leaf flow graph. The adopted semantics is **projected-level condensation with derived return edges**:

1. The existing quotient partition (maximal weakly connected same-boundary components) is computed cycle-tolerantly — it never needed acyclicity, only the topological-order prerequisite did.
2. A loop that closes inside one boundary at the selected view collapses into that boundary's composite and becomes invisible — the **tau-loop rule**, the same shape as the `tau` rule that hides same-boundary flows and same-boundary directed effects.
3. A loop that crosses boundaries at the selected view survives as a cycle _between projected components_. A canonical order over the projected graph (topological order of its SCC condensation, deterministic inside each SCC) linearizes the view, and every projected flow that goes against that order is classified as a **return edge** (`kind: "return"`), drawn as a distinct back edge.

A key observation motivates this: the projected quotient graph can **already** be cyclic today, even for acyclic models. `src/__tests__/quotient.test.ts` (“the quotient graph may contain cycles between distinct boundaries”) projects the DAG `a(t1) → b(t2)`, `a → c(t1)`, `b → c` to `t1 ⇄ t2`, and the viewer renders it. Cross-boundary cycles at the view level are therefore not new vocabulary; this design extends the graph class of the _input_ without changing the language of the _output_.

## Graph class

The input is a finite directed Activity graph over the selected scope's leaves:

- Branching, merging, and directed cycles are in scope.
- The scope must still be weakly connected; disconnected scopes remain a modeling error.
- **Self-loops (a flow from an Activity to itself) are rejected** with an explicit error; see [Self-loops](#self-loops).

The DAG case must remain a special case: for an acyclic model, the result is identical to the current `projectDagByResponsibilityBoundary` output.

## Projection pipeline

For a selected (drill-down scope, boundary expression) view, `project` is defined by:

1. **Scope.** Take the scope's leaf Activities and the flows between them, as today (`INV-4`). Reject self-loops and weakly disconnected scopes with explicit errors.
2. **Partition.** Assign each leaf its boundary with `boundaryOf(activity, boundary)` and partition leaves into maximal weakly connected components of the induced same-boundary subgraph — the unchanged quotient rule of [`docs/nonlinear-projection.md`](nonlinear-projection.md). This step never required acyclicity.
3. **Collapse.** Each component becomes one projected Activity; flows inside a component become self-edges and are hidden (unchanged rule). This is what makes the tau-loop rule hold: a cycle whose members all share one boundary at this view lies inside one component and vanishes.
4. **Canonical order.** The projected graph may still contain cycles — exactly when a loop crosses boundaries at this view. Compute the strongly connected components (SCCs) _of the projected graph_ and their condensation, which is a DAG. The **canonical order** of projected Activities is: topological order of the condensation (Kahn's algorithm, FIFO, stable by first appearance — the existing determinism rule), and inside each non-trivial SCC a breadth-first order from the SCC's entry components (components that receive an edge from outside the SCC, or contain a scope start), with ties broken by first appearance. For an acyclic projected graph every SCC is a single node and the canonical order _is_ the topological order used today.
5. **Return classification.** A projected flow `u → v` is a **forward edge** when `v` comes strictly after `u` in the canonical order, and a **return edge** (`kind: "return"`) otherwise. Edges between different SCCs are always forward (the condensation is a DAG); only edges inside a non-trivial SCC can be classified as return. The forward subgraph is acyclic by construction, and every projected cycle contains at least one return edge.

The same pipeline applies at the leaf level to order component members and derive entry/exit sets: member order inside a composite, and the enumeration order of components, follow the canonical order of the _leaf_ graph (SCC condensation of the leaf graph, same rule as step 4). Entry/exit derivation and the product-style type composition of [`docs/nonlinear-projection.md`](nonlinear-projection.md) are unchanged — they were already defined by component-external edges and scope starts/terminals, none of which assume acyclicity.

### RBNF extension

The RBNF quotient rule is unchanged: same-boundary internal steps are `tau` and collapse; boundary-crossing steps are observable. What loops add is a stronger **representative selection**: the normal form additionally fixes the canonical order and the forward/return classification. Both are deterministic functions of the model and the view, so projection stays a pure, reproducible function.

The classification is a _representative choice_, not a semantic claim. Which edge of a cycle is “the rework edge” is not stored in the model and is not asserted by the projection; the semantic content is the cycle itself (reachability, `INV-8`). A different canonical order would mark a different edge as return and describe the same quotient. This mirrors how RBNF already picks one minimized representative of an equivalence class (`docs/semantic-core.md`, “Normal form terminology”).

## The tau-loop rule (visibility under boundary zoom)

> A loop is invisible at a view **iff** all of its member Activities project to the same boundary at that view.

Both directions follow from the partition rule. If all members share one boundary, every cycle edge is a same-boundary flow, so the members are weakly connected in the same-boundary subgraph, land in one component, and the cycle collapses to hidden self-edges. If any cycle edge crosses boundaries at this view, its endpoints are in different components (components never span boundaries), so the cycle survives as a projected cycle and produces exactly one return edge per canonical-order “wrap”.

This is the loop analogue of the v1 effect rule (“an effect whose resolved source and directed target coincide at the selected boundary is internal (`tau`) and hidden”, [`docs/responsible-v1.md`](responsible-v1.md)): coarse views legitimately cannot see iteration that is some finer boundary's internal business. Zooming in past the boundary that contains the loop makes the return edge appear.

## Cross-boundary loops

A loop spanning boundaries (department A → department B → department A) is displayed with both participating components visible and a marked return edge, rather than being folded into one opaque node. This directly addresses the risk noted for whole-SCC condensation: at the coarse view you still see _which_ boundaries reciprocate, and the responsibility hand-offs of the loop remain observable — they are the boundary-crossing observations `INV-8` promises to preserve.

## Nested loops and drill-down

SCCs are maximal, so at any single view there is no “SCC inside an SCC”. Nesting appears across views, and the pipeline handles it by uniform recursion — every (scope, boundary) view applies the same five steps:

- **Boundary refinement.** A loop invisible at `department` (closed inside 営業部) may appear at `team` when its members split across teams. Conversely, two overlapping cycles at a fine view may merge into one projected SCC, or vanish entirely, at a coarser view.
- **Drill-down.** Opening a decomposition scope re-runs the pipeline on that scope's leaves; loops closed inside a child scope appear there, with their own canonical order and return edges.
- **Shared-node loops.** Two cycles sharing an Activity form one SCC; the canonical order represents both with multiple return edges. No special case is needed.

## Self-loops

A flow `{ "from": "x", "to": "x" }` is **rejected** as a modeling error, reported by structural validation with the flow's JSON path (and defensively by the projector).

Rationale: a self-loop's endpoints share every responsibility attribute, so it projects to a hidden self-edge at _every_ boundary and every zoom level — it is unobservable structure that no view can ever show, which makes it a silent footgun rather than a modeling freedom. Rejection with guidance is consistent with the project's “explicit error over blank output” policy. Iteration that is internal to a single Activity should be modeled either as a decomposition (`children` whose flows form the loop, visible via drill-down) or as contract vocabulary (`requires` / `ensures` describing the rework condition).

## Error reporting

After loop semantics, the remaining rejection paths of the quotient projector are:

| Case                      | Report                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weakly disconnected scope | Unchanged explicit error (“one weakly connected flow”).                                                                                              |
| Self-loop                 | New validation issue with the flow's JSON path, plus a defensive projector error (see above).                                                        |
| Cycles (general)          | **No longer an error** once stage 1 lands. The current “cycle detected” error and the viewer's per-scope error panel are removed by the staged plan. |

## Schema impact

- **Model schema: unchanged.** Loop projection is a projection capability over `responsible.v0` / `responsible.v1` documents, the same standing decision as DAG projection (`docs/nonlinear-projection.md`). No `responsible.v2` is needed; cycles are already expressible in `flows`, they are merely rejected at projection time today.
- **View type: one additive field.** `ProjectedFlow` (`src/model.ts`) gains an optional `kind?: "return"`; forward edges stay shape-identical to today's output. `ProcessView` remains JSON-serializable output, so this is not a model document change.
- **Effects: orthogonal.** `projectEffects` (`src/effects.ts`) resolves boundaries per Activity and never traverses flows, so declared v1 effects and the `INV-3` checks are unaffected by cycles.
- **Contracts: orthogonal.** `requires` / `ensures` are per-Activity declarations; a consistent contract chain around a cycle (rework re-establishes the facts the next iteration requires) needs no new machinery — see the example, where both `draft` and `revise` ensure `Application.status = draft`, which `submit` requires.

## Rejected alternatives

### Model-level SCC condensation (single loop-scope node)

Contract each SCC of the _model_ graph into one composite “loop scope” node before projecting; the graph becomes a DAG and the existing projector applies unchanged, with loop internals visible only via drill-down.

Rejected because:

- A cross-boundary loop (department A ⇄ department B) collapses into a single node at exactly the views where its hand-offs matter; which boundaries reciprocate becomes invisible. This is the information-loss risk flagged in the design issue itself, and it weakens `INV-8` (boundary-crossing observations inside the SCC are dropped from the projected graph, not preserved).
- It is visually inconsistent: acyclic models can already project to cross-boundary view cycles (`t1 ⇄ t2` above) and are rendered as such, while the same reciprocating shape born from a cyclic model would render as one opaque node. Same observable structure, two presentations.
- A multi-boundary loop node has no home lane; the lane layout would need a new node species anyway, erasing most of the “reuse the DAG projector unchanged” appeal.

### Explicit loop annotation (`kind: "return"` on model flows)

Let the modeler mark return flows in the document; projection treats marked edges specially and requires the unmarked subgraph to be acyclic.

Rejected because:

- It is a model schema change (a new `FlowDef` field, hence a `responsible.v2` under the compatibility principle of [`docs/responsible-v1.md`](responsible-v1.md)) for information the projection can derive.
- The annotation burden lands on every modeler, and verifying it (detecting a cycle none of whose edges is marked, or spurious marks) requires exactly the cycle analysis the derived design already performs — the annotation buys no verification power.
- Which edge is “the return” is presentation-layer vocabulary, and the project's stance is that views are computed: “how it is drawn” does not belong in the model. The derived classification keeps the model document purely structural.

A future, optional _hint_ (a modeler-preferred return edge that overrides the canonical choice when consistent) could be layered on later without changing these semantics; it is explicitly not part of this design.

## Invariants under loops

| Invariant | Status under loops                              | Notes                                                                                                                                                                                                                 |
| --------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INV-1`   | Holds                                           | Partition, condensation, ordering, and classification are pure functions of the model and view; projection stays read-only.                                                                                           |
| `INV-2`   | Holds (unaffected)                              | Loops are structural; mutation remains an execution concern, and no execution semantics is introduced.                                                                                                                |
| `INV-3`   | Holds (unaffected)                              | Effect projection never traverses flows; directed source/target resolution and its checks are independent of cyclicity.                                                                                               |
| `INV-4`   | Holds                                           | Projection is still computed from the leaf Activities of the selected scope; condensation happens after leaf projection, not instead of it.                                                                           |
| `INV-5`   | Holds                                           | The quotient stays lossy and non-reversible; canonical order and return classification are representative choices and add no inverse mapping.                                                                         |
| `INV-6`   | Holds (reformulated derivation, same statement) | A strongly connected region still yields Activity-shaped components: entries/exits are defined by component-external edges and scope starts/terminals, which never assumed acyclicity; type composition is unchanged. |
| `INV-7`   | Holds by construction                           | A projected edge between distinct same-boundary components is impossible: such an edge would have merged them in step 2. Return edges included.                                                                       |
| `INV-8`   | Holds over the full edge set                    | Reachability between boundary-crossing observations is preserved by forward **and** return edges together; the forward subgraph alone does not and must not be read as the complete flow relation.                    |
| `INV-9`   | **New**                                         | Every projected flow either strictly increases the canonical order or carries `kind: "return"`; hence the forward subgraph is acyclic and the classification is deterministic.                                        |
| `INV-10`  | **New**                                         | Tau-loop rule: a cycle whose members all project to one boundary at the selected view produces no cycle and no return edge in that view.                                                                              |

`INV-1`–`INV-6` are defined in [`docs/semantic-core.md`](semantic-core.md); `INV-7` / `INV-8` in [`docs/nonlinear-projection.md`](nonlinear-projection.md).

## Example: application approval with rework

The canonical rework pattern — 申請 → 審査 → 差し戻し → 申請. The reviewer's decision is an Activity output (branching is an Activity that outputs a decision, never a gateway); `審査結果` stands for the union 差し戻し | 承認可, and the consumers' `requires` make the branch conditions explicit. The complete model (parses as `responsible.v1`; stage 2 uses it as a test fixture):

```json
{
  "schemaVersion": "responsible.v1",
  "activities": {
    "draft_application": {
      "id": "draft_application",
      "name": "申請書を作成する",
      "input": "顧客要望",
      "output": "申請書ドラフト",
      "status": "defined",
      "responsibility": {
        "company": "あおい商事",
        "department": "営業部",
        "section": "営業一課",
        "team": "見積チーム",
        "person": "山田"
      },
      "ensures": ["Application.status = draft"]
    },
    "submit_application": {
      "id": "submit_application",
      "name": "申請を提出する",
      "input": "申請書ドラフト",
      "output": "提出済み申請",
      "status": "defined",
      "responsibility": {
        "company": "あおい商事",
        "department": "営業部",
        "section": "営業一課",
        "team": "見積チーム",
        "person": "山田"
      },
      "requires": ["Application.status = draft"],
      "ensures": ["Application.status = submitted"]
    },
    "review_application": {
      "id": "review_application",
      "name": "申請を審査する",
      "input": "提出済み申請",
      "output": "審査結果",
      "status": "defined",
      "responsibility": {
        "company": "あおい商事",
        "department": "管理部",
        "section": "審査課",
        "team": "審査チーム",
        "person": "田中"
      },
      "requires": ["Application.status = submitted"],
      "ensures": ["Application.status = reviewed", "ReviewResult = 差し戻し | 承認可"],
      "effects": [
        {
          "payload": { "kind": "command", "schema": "差し戻し通知" },
          "delivery": {
            "mode": "directed",
            "target": {
              "company": "あおい商事",
              "department": "営業部",
              "section": "営業一課",
              "team": "見積チーム",
              "person": "山田"
            }
          }
        }
      ]
    },
    "revise_application": {
      "id": "revise_application",
      "name": "申請を修正する",
      "input": "審査結果",
      "output": "申請書ドラフト",
      "status": "defined",
      "responsibility": {
        "company": "あおい商事",
        "department": "営業部",
        "section": "営業一課",
        "team": "見積チーム",
        "person": "山田"
      },
      "requires": ["ReviewResult = 差し戻し"],
      "ensures": ["Application.status = draft"]
    },
    "approve_application": {
      "id": "approve_application",
      "name": "申請を承認する",
      "input": "審査結果",
      "output": "承認済み申請",
      "status": "defined",
      "responsibility": {
        "company": "あおい商事",
        "department": "管理部",
        "section": "審査課",
        "team": "承認チーム",
        "person": "鈴木"
      },
      "requires": ["ReviewResult = 承認可"],
      "ensures": ["Application.status = approved"]
    }
  },
  "flows": [
    { "from": "draft_application", "to": "submit_application" },
    { "from": "submit_application", "to": "review_application" },
    { "from": "review_application", "to": "revise_application" },
    { "from": "revise_application", "to": "submit_application" },
    { "from": "review_application", "to": "approve_application" }
  ]
}
```

The cycle is `submit → review → revise → submit`; the leaf SCCs are `{draft}`, `{submit, review, revise}`, `{approve}`, so the canonical leaf order is `draft, submit, review, revise, approve`.

### Expected projection per boundary level

**`company`** — every Activity is あおい商事; one component, no flows. The loop is invisible (`INV-10`), and the process reads as its outer contract:

```text
[あおい商事: 作成+提出+審査+修正+承認]   input: 顧客要望   output: 承認済み申請
```

Projected activities: `composite:draft_application+submit_application+review_application+revise_application+approve_application`. Flows: none.

**`department`** — 営業部 `{draft, submit, revise}` (weakly connected through the same-boundary flows `draft→submit` and `revise→submit`) and 管理部 `{review, approve}` (connected through `review→approve`). The surviving edges `submit→review` and `review→revise` form a projected cycle; the canonical order starts at the component containing the scope start (`draft`), so `review→revise`'s image is the return edge:

```text
[営業部: 作成+提出+修正] ──▶ [管理部: 審査+承認]
        ▲                        │
        └────── return ──────────┘
```

| Projected Activity                      | Boundary | Input                 | Output                    |
| --------------------------------------- | -------- | --------------------- | ------------------------- |
| `composite:draft+submit+revise` (short) | 営業部   | `顧客要望 & 審査結果` | `提出済み申請`            |
| `composite:review+approve` (short)      | 管理部   | `提出済み申請`        | `審査結果 & 承認済み申請` |

Flows: `営業部 → 管理部` (forward), `管理部 → 営業部` (`kind: "return"`). The directed `差し戻し通知` effect is also visible here — its source (管理部) and target (営業部) differ at this view.

**`section`** — same shape as `department`: 営業一課 `{draft, submit, revise}` ⇄ 審査課 `{review, approve}`.

**`team`** — the reviewer and approver split: 見積チーム `{draft, submit, revise}`, 審査チーム `{review}`, 承認チーム `{approve}`. Canonical order: 見積, 審査, 承認.

```text
[見積チーム: 作成+提出+修正] ──▶ [審査チーム: 審査] ──▶ [承認チーム: 承認]
        ▲                             │
        └────────── return ───────────┘
```

Flows: `見積 → 審査` (forward), `審査 → 見積` (`kind: "return"`), `審査 → 承認` (forward).

**`person`** — identical shape to `team` with 山田 `{draft, submit, revise}`, 田中 `{review}`, 鈴木 `{approve}`; the return edge is `田中 → 山田`. The rework fold (`draft+submit+revise`) stays one composite at every level because its members share one person — its internals are inspectable through the existing composite expansion, not through further zoom.

## Viewer rendering policy

- **Layout on the forward skeleton.** The canonical order supplies `flowIndex` (x-axis position within lanes), so the existing layered lane layout keeps working unchanged; return edges take no part in horizontal ordering.
- **Return edges are visually distinct** from both forward flow edges and dashed effect edges: routed as a back-swinging curve with an arrowhead making the direction unmistakable (exact styling is a stage 3 decision; the requirement is three distinguishable edge species — forward flow, return flow, effect).
- **Boundary zoom behavior follows the tau-loop rule**: zooming out past the boundary that encloses a loop removes its return edge together with the fold; zooming in makes it appear. This is observable in the example above between `company` and `department`.
- **Drill-down is unchanged**: opening a scope re-projects that scope with the same pipeline, so loops closed inside a child scope show up there.
- **Error panel retirement**: the viewer's per-scope “cycles unsupported” error panel disappears with stage 3; self-loops and disconnected scopes keep their explicit reports.

## Staged plan

| Stage | Scope                                                                                                                                                                                                                           | Issue                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1     | Core cycle-tolerant projection: replace the topological prerequisite with canonical order (condensation + intra-SCC BFS), return-edge classification (`ProjectedFlow.kind`), self-loop rejection, DAG byte-compatibility, tests | [#31](https://github.com/f4ah6o/responsible/issues/31) |
| 2     | Invariant coverage: `INV-1`–`INV-10` under loops, this document's example as fixture, RBNF checker update, determinism and effect-orthogonality tests                                                                           | [#32](https://github.com/f4ah6o/responsible/issues/32) |
| 3     | Viewer: return-edge rendering, layout on the forward skeleton, bundled rework sample + `examples/` JSON, cycle error-panel retirement, README updates                                                                           | [#33](https://github.com/f4ah6o/responsible/issues/33) |

Later stages must not begin before the previous stage's acceptance criteria pass, but each stage is independently shippable — the same protocol as [`docs/responsible-v1.md`](responsible-v1.md).

## Assertable subset

After stage 2, tests must be able to assert:

- DAG models project byte-identically to the pre-loop projector (conservative extension).
- The tau-loop rule (`INV-10`): the example projects to a single flow-less composite at `company` and to the documented cycles at finer levels.
- Forward-subgraph acyclicity and deterministic classification (`INV-9`), including repeated-projection determinism.
- Self-loop rejection with a JSON-path issue; disconnected-scope rejection unchanged.
- `projectEffects` results are unchanged by the presence of cycles (`INV-3` orthogonality).
- Read-only projection (`INV-1`) and the absence of any inverse-projection API (`INV-5`) over cyclic inputs.
