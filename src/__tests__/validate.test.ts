import { test } from "node:test";
import assert from "node:assert/strict";

import {
  type ProcessModel,
  ensureRootActivity,
  inferRootActivityId,
  parseProcessModelJson,
  projectByResponsibilityBoundary,
  validateProcessModel,
} from "../index.js";

const validModel = {
  schemaVersion: "responsible.v0",
  activities: {
    a: { id: "a", input: "Inquiry", output: "Estimate", responsibility: { team: "sales" } },
    b: { id: "b", input: "Estimate", output: "Approved", responsibility: { team: "eng" } },
  },
  flows: [{ from: "a", to: "b" }],
};

function issuePaths(value: unknown): string[] {
  const result = validateProcessModel(value);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  return result.issues.map((issue) => issue.path);
}

test("validateProcessModel accepts a well-formed model", () => {
  const result = validateProcessModel(validModel);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  assert.equal(Object.keys(result.model.activities).length, 2);
});

test("validateProcessModel rejects non-object input", () => {
  assert.deepEqual(issuePaths("not a model"), ["$"]);
  assert.deepEqual(issuePaths(null), ["$"]);
  assert.deepEqual(issuePaths([1, 2]), ["$"]);
});

test("validateProcessModel rejects an unknown schemaVersion", () => {
  const paths = issuePaths({ ...validModel, schemaVersion: "responsible.v2" });
  assert.equal(paths.includes("$.schemaVersion"), true);
});

test("validateProcessModel rejects an empty activities record", () => {
  const paths = issuePaths({ ...validModel, activities: {}, flows: [] });
  assert.equal(paths.includes("$.activities"), true);
});

test("validateProcessModel reports id / key mismatch", () => {
  const paths = issuePaths({
    ...validModel,
    activities: {
      ...validModel.activities,
      a: { ...validModel.activities.a, id: "other" },
    },
  });
  assert.equal(paths.includes("$.activities.a.id"), true);
});

test("validateProcessModel reports missing input/output and bad status", () => {
  const paths = issuePaths({
    schemaVersion: "responsible.v0",
    activities: { a: { id: "a", input: "", status: "wip" } },
    flows: [],
  });
  assert.equal(paths.includes("$.activities.a.input"), true);
  assert.equal(paths.includes("$.activities.a.output"), true);
  assert.equal(paths.includes("$.activities.a.status"), true);
});

test("validateProcessModel reports flows referencing unknown activities", () => {
  const paths = issuePaths({ ...validModel, flows: [{ from: "a", to: "ghost" }] });
  assert.equal(paths.includes("$.flows[0].to"), true);
});

test("validateProcessModel reports children referencing unknown activities", () => {
  const paths = issuePaths({
    ...validModel,
    activities: {
      ...validModel.activities,
      a: { ...validModel.activities.a, children: ["ghost"] },
    },
  });
  assert.equal(paths.includes("$.activities.a.children[0]"), true);
});

test("validateProcessModel reports decomposition cycles", () => {
  const paths = issuePaths({
    schemaVersion: "responsible.v0",
    activities: {
      a: { id: "a", input: "X", output: "Y", children: ["b"] },
      b: { id: "b", input: "X", output: "Y", children: ["a"] },
    },
    flows: [],
  });
  assert.equal(
    paths.some((path) => path.endsWith(".children")),
    true,
  );
});

test("validateProcessModel rejects invalid responsibility values", () => {
  const paths = issuePaths({
    ...validModel,
    activities: {
      ...validModel.activities,
      a: { ...validModel.activities.a, responsibility: { team: () => "sales" } },
    },
  });
  assert.equal(paths.includes("$.activities.a.responsibility"), true);
});

test("validateProcessModel validates optional views", () => {
  const paths = issuePaths({
    ...validModel,
    views: [{ id: "", layout: "grid", boundary: 3, normalForm: "other" }],
  });
  assert.equal(paths.includes("$.views[0].id"), true);
  assert.equal(paths.includes("$.views[0].layout"), true);
  assert.equal(paths.includes("$.views[0].boundary"), true);
  assert.equal(paths.includes("$.views[0].normalForm"), true);
});

test("parseProcessModelJson reports malformed JSON with a readable message", () => {
  const result = parseProcessModelJson("{ not json");
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.issues[0]?.path, "$");
  assert.match(result.issues[0]?.message ?? "", /JSON/);
});

test("parseProcessModelJson round-trips a valid model", () => {
  const result = parseProcessModelJson(JSON.stringify(validModel));
  assert.equal(result.ok, true);
});

test("inferRootActivityId finds the unique root", () => {
  const model: ProcessModel = {
    schemaVersion: "responsible.v0",
    activities: {
      root: { id: "root", input: "X", output: "Z", children: ["a", "b"] },
      a: { id: "a", input: "X", output: "Y" },
      b: { id: "b", input: "Y", output: "Z" },
    },
    flows: [{ from: "a", to: "b" }],
  };
  assert.equal(inferRootActivityId(model), "root");
});

test("inferRootActivityId returns undefined for flat models", () => {
  assert.equal(inferRootActivityId(validModel as unknown as ProcessModel), undefined);
});

test("ensureRootActivity keeps a model that already has a unique root", () => {
  const model: ProcessModel = {
    schemaVersion: "responsible.v0",
    activities: {
      root: { id: "root", input: "X", output: "Y", children: ["a"] },
      a: { id: "a", input: "X", output: "Y" },
    },
    flows: [],
  };
  const rooted = ensureRootActivity(model);
  assert.equal(rooted.rootActivityId, "root");
  assert.equal(rooted.model, model);
});

test("ensureRootActivity wraps flat models in a synthetic root", () => {
  const rooted = ensureRootActivity(validModel as unknown as ProcessModel);
  const root = rooted.model.activities[rooted.rootActivityId];
  assert.notEqual(root, undefined);
  assert.deepEqual(root?.children, ["a", "b"]);
  // Input/output derive from the unique start/end of the flow.
  assert.equal(root?.input, "Inquiry");
  assert.equal(root?.output, "Approved");
  // The original model is not mutated.
  assert.equal(inferRootActivityId(validModel as unknown as ProcessModel), undefined);
});

test("ensureRootActivity avoids id collisions with existing activities", () => {
  const model = {
    schemaVersion: "responsible.v0",
    activities: {
      __process__: { id: "__process__", input: "X", output: "Y" },
      a: { id: "a", input: "X", output: "Y" },
    },
    flows: [],
  } as unknown as ProcessModel;
  const rooted = ensureRootActivity(model);
  assert.notEqual(rooted.rootActivityId, "__process__");
  assert.notEqual(rooted.model.activities[rooted.rootActivityId], undefined);
});

test("a validated flat model projects after ensureRootActivity", () => {
  const parsed = parseProcessModelJson(JSON.stringify(validModel));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("unreachable");

  const rooted = ensureRootActivity(parsed.model);
  const view = projectByResponsibilityBoundary(
    {
      schemaVersion: rooted.model.schemaVersion,
      activities: {
        a: rooted.model.activities["a"]!,
        b: rooted.model.activities["b"]!,
      },
      flows: rooted.model.flows,
    },
    { id: "v", layout: "lane", boundary: "team", normalForm: "responsibilityBoundary" },
  );
  assert.equal(view.activities.length, 2);
});
