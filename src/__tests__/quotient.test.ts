import { test } from "node:test";
import assert from "node:assert/strict";

import {
  type ProcessModel,
  type ProcessView,
  type ViewDef,
  isResponsibilityBoundaryNormalForm,
  leafActivityIds,
  projectByResponsibilityBoundary,
  projectDagByResponsibilityBoundary,
} from "../index.js";
import { sampleProcesses } from "../sample.js";

const teamView: ViewDef = {
  id: "team_view",
  layout: "lane",
  boundary: "team",
  normalForm: "responsibilityBoundary",
};

const companyView: ViewDef = {
  id: "company_view",
  layout: "lane",
  boundary: "company",
  normalForm: "responsibilityBoundary",
};

function model(
  activities: Record<string, { team: string; input?: string; output?: string }>,
  flows: [string, string][],
): ProcessModel {
  const defs: Record<string, import("../model.js").ActivityDef> = {};
  for (const [id, def] of Object.entries(activities)) {
    defs[id] = {
      id,
      input: def.input ?? `${id}_in`,
      output: def.output ?? `${id}_out`,
      responsibility: { team: def.team, company: "acme" },
    };
  }
  return {
    schemaVersion: "responsible.v0",
    activities: defs,
    flows: flows.map(([from, to]) => ({ from, to })),
  };
}

function boundariesOf(view: ProcessView): string[] {
  return view.activities.map((activity) => activity.boundary);
}

function flowPairs(view: ProcessView): string[] {
  return view.flows.map((flow) => `${flow.from}->${flow.to}`);
}

// --- Linear special case -----------------------------------------------

test("DAG projection equals linear projection on linear models", () => {
  const linear = model(
    {
      a: { team: "sales" },
      b: { team: "sales" },
      c: { team: "eng" },
      d: { team: "sales" },
    },
    [
      ["a", "b"],
      ["b", "c"],
      ["c", "d"],
    ],
  );

  assert.deepEqual(
    projectDagByResponsibilityBoundary(linear, teamView),
    projectByResponsibilityBoundary(linear, teamView),
  );
});

test("DAG projection equals linear projection on every linear sample process", () => {
  for (const sample of sampleProcesses) {
    const leaves = leafActivityIds(sample.model, sample.rootActivityId);
    const include = new Set(leaves);
    const scoped: ProcessModel = {
      schemaVersion: sample.model.schemaVersion,
      activities: Object.fromEntries(leaves.map((id) => [id, sample.model.activities[id]!])),
      flows: sample.model.flows.filter((flow) => include.has(flow.from) && include.has(flow.to)),
    };

    let linear: ProcessView;
    try {
      linear = projectByResponsibilityBoundary(scoped, teamView);
    } catch {
      continue; // nonlinear sample: covered by dedicated tests below
    }
    assert.deepEqual(
      projectDagByResponsibilityBoundary(scoped, teamView),
      linear,
      `${sample.id}: quotient must match linear projection`,
    );
  }
});

// --- Branch and merge (docs/nonlinear-projection.md example 1) ----------

const branchMerge = model(
  {
    a: { team: "Product" },
    b: { team: "Engineering" },
    c: { team: "QA" },
    d: { team: "Release" },
  },
  [
    ["a", "b"],
    ["a", "c"],
    ["b", "d"],
    ["c", "d"],
  ],
);

test("branch and merge keeps different-boundary branches separate", () => {
  const view = projectDagByResponsibilityBoundary(branchMerge, teamView);
  assert.deepEqual(boundariesOf(view), ["Product", "Engineering", "QA", "Release"]);
  assert.deepEqual(flowPairs(view).sort(), ["a->b", "a->c", "b->d", "c->d"]);
  assert.equal(isResponsibilityBoundaryNormalForm(view), true);
});

test("branch and merge collapses to one component at company boundary", () => {
  const view = projectDagByResponsibilityBoundary(branchMerge, companyView);
  assert.equal(view.activities.length, 1);
  assert.equal(view.flows.length, 0);
  const only = view.activities[0]!;
  assert.equal(only.kind, "composite");
  if (only.kind !== "composite") throw new Error("unreachable");
  assert.deepEqual([...only.activityIds].sort(), ["a", "b", "c", "d"]);
  // Single scope start and terminal keep their original type refs.
  assert.equal(only.input, "a_in");
  assert.equal(only.output, "d_out");
});

// --- Same-boundary branch (docs/nonlinear-projection.md example 2) ------

test("same-boundary parallel branches stay separate components (INV-7)", () => {
  const sameBoundaryBranch = model(
    {
      a: { team: "Product" },
      b: { team: "Engineering" },
      c: { team: "Engineering" },
      d: { team: "QA" },
    },
    [
      ["a", "b"],
      ["a", "c"],
      ["b", "d"],
      ["c", "d"],
    ],
  );
  const view = projectDagByResponsibilityBoundary(sameBoundaryBranch, teamView);
  assert.deepEqual(boundariesOf(view), ["Product", "Engineering", "Engineering", "QA"]);
  // No edge between the two Engineering components: they are not connected
  // by any same-boundary flow, so INV-7 merging does not apply and no flow
  // exists between them in the source graph either.
  assert.deepEqual(flowPairs(view).sort(), ["a->b", "a->c", "b->d", "c->d"]);
  assert.equal(isResponsibilityBoundaryNormalForm(view), true);
});

test("a same-boundary flow merges the branch into one component", () => {
  const merged = model(
    {
      a: { team: "Product" },
      b: { team: "Engineering" },
      c: { team: "Engineering" },
      d: { team: "QA" },
    },
    [
      ["a", "b"],
      ["b", "c"],
      ["c", "d"],
      ["a", "c"],
    ],
  );
  const view = projectDagByResponsibilityBoundary(merged, teamView);
  assert.deepEqual(boundariesOf(view), ["Product", "Engineering", "QA"]);
  const composite = view.activities[1]!;
  assert.equal(composite.kind, "composite");
  if (composite.kind !== "composite") throw new Error("unreachable");
  assert.deepEqual(composite.activityIds, ["b", "c"]);
  // Both b (from a) and c (from a) are entered from outside the component,
  // so the component input is the product of both entry refs.
  assert.equal(composite.input, "b_in & c_in");
  assert.equal(composite.output, "c_out");
});

// --- Type composition ----------------------------------------------------

test("a merge component with multiple external entries gets a product input", () => {
  const m = model(
    {
      a: { team: "t1" },
      b: { team: "t2" },
      c: { team: "t3" },
      d: { team: "t2" },
    },
    [
      ["a", "b"],
      ["a", "c"],
      ["b", "d"],
      ["c", "d"],
    ],
  );
  const view = projectDagByResponsibilityBoundary(m, teamView);
  const t2 = view.activities.find((activity) => activity.boundary === "t2")!;
  assert.equal(t2.kind, "composite");
  assert.equal(t2.input, "b_in & d_in");
  assert.equal(t2.output, "d_out");
});

test("multiple scope terminals produce a product output", () => {
  const m = model(
    {
      a: { team: "t1" },
      b: { team: "t2" },
      c: { team: "t3" },
    },
    [
      ["a", "b"],
      ["a", "c"],
    ],
  );
  const view = projectDagByResponsibilityBoundary(m, companyView);
  assert.equal(view.activities.length, 1);
  assert.equal(view.activities[0]!.output, "b_out & c_out");
});

// --- Quotient graph shape -------------------------------------------------

test("the quotient graph may contain cycles between distinct boundaries", () => {
  // a -> c is a same-boundary flow, so {a, c} is one t1 component; b sits
  // between them, producing t1 -> t2 -> t1 in the projected graph.
  const m = model(
    {
      a: { team: "t1" },
      b: { team: "t2" },
      c: { team: "t1" },
    },
    [
      ["a", "c"],
      ["a", "b"],
      ["b", "c"],
    ],
  );
  const view = projectDagByResponsibilityBoundary(m, teamView);
  assert.equal(view.activities.length, 2);
  assert.deepEqual(flowPairs(view).sort(), ["b->composite:a+c", "composite:a+c->b"]);
  assert.equal(isResponsibilityBoundaryNormalForm(view), true);
});

test("projection is deterministic", () => {
  const first = JSON.stringify(projectDagByResponsibilityBoundary(branchMerge, teamView));
  const second = JSON.stringify(projectDagByResponsibilityBoundary(branchMerge, teamView));
  assert.equal(first, second);
});

test("composite ids distinguish source ids containing the legacy delimiter", () => {
  const m = model(
    {
      start: { team: "start" },
      "a+b": { team: "same" },
      c: { team: "same" },
      a: { team: "same" },
      "b+c": { team: "same" },
      end: { team: "end" },
    },
    [
      ["start", "a+b"],
      ["start", "a"],
      ["a+b", "c"],
      ["a", "b+c"],
      ["c", "end"],
      ["b+c", "end"],
    ],
  );
  const composites = projectDagByResponsibilityBoundary(m, teamView).activities.filter(
    (activity) => activity.kind === "composite",
  );
  assert.equal(composites.length, 2);
  assert.notEqual(composites[0]!.id, composites[1]!.id);
});

test("an atomic id cannot collide with a composite id", () => {
  const m = model(
    {
      start: { team: "start" },
      a: { team: "same" },
      b: { team: "same" },
      "composite:a+b": { team: "same" },
      end: { team: "end" },
    },
    [
      ["start", "a"],
      ["a", "b"],
      ["b", "end"],
      ["start", "composite:a+b"],
      ["composite:a+b", "end"],
    ],
  );
  const projected = projectDagByResponsibilityBoundary(m, teamView);
  const ids = projected.activities.map((activity) => activity.id);
  assert.equal(new Set(ids).size, ids.length);
  const composite = projected.activities.find((activity) => activity.kind === "composite");
  assert.ok(composite);
  assert.notEqual(composite.id, "composite:a+b");
});

test("projected flow deduplication preserves arrow-containing endpoint pairs", () => {
  const m = model(
    {
      start: { team: "start" },
      a: { team: "a" },
      "a->b": { team: "ab" },
      "b->c": { team: "bc" },
      c: { team: "c" },
    },
    [
      ["start", "a"],
      ["start", "a->b"],
      ["a", "b->c"],
      ["a->b", "c"],
    ],
  );
  const projected = projectDagByResponsibilityBoundary(m, teamView);
  assert.equal(projected.flows.length, 4);
  assert.equal(
    new Set(projected.flows.map((flow) => JSON.stringify([flow.from, flow.to]))).size,
    4,
  );
});

// --- Rejections ------------------------------------------------------------

test("cycles are rejected with an explicit error", () => {
  const cyclic = model(
    {
      a: { team: "t1" },
      b: { team: "t2" },
    },
    [
      ["a", "b"],
      ["b", "a"],
    ],
  );
  assert.throws(() => projectDagByResponsibilityBoundary(cyclic, teamView), /cycle detected/);
});

test("weakly disconnected scopes are rejected", () => {
  const disconnected = model(
    {
      a: { team: "t1" },
      b: { team: "t2" },
      c: { team: "t3" },
      d: { team: "t4" },
    },
    [
      ["a", "b"],
      ["c", "d"],
    ],
  );
  assert.throws(
    () => projectDagByResponsibilityBoundary(disconnected, teamView),
    /weakly connected/,
  );
});

test("flow endpoints do not silently discard an orphan Activity", () => {
  const m = model(
    {
      a: { team: "t1" },
      b: { team: "t2" },
      orphan: { team: "t3" },
    },
    [["a", "b"]],
  );
  assert.throws(() => projectDagByResponsibilityBoundary(m, teamView), /disconnected: orphan/);
});

test("an isolated Activity is retained as an atomic projection", () => {
  const m = model({ orphan: { team: "t3" } }, []);
  const projected = projectDagByResponsibilityBoundary(m, teamView);
  assert.deepEqual(
    projected.activities.map((activity) => activity.id),
    ["orphan"],
  );
});

test("unsupported layouts and normal forms are rejected", () => {
  assert.throws(() =>
    projectDagByResponsibilityBoundary(branchMerge, {
      ...teamView,
      layout: "grid" as unknown as "lane",
    }),
  );
  assert.throws(() =>
    projectDagByResponsibilityBoundary(branchMerge, {
      ...teamView,
      normalForm: "other" as unknown as "responsibilityBoundary",
    }),
  );
});
