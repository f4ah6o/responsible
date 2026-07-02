/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  type Id,
  type ProcessModel,
  type ViewDef,
  leafActivityIds,
  projectByResponsibilityBoundary,
} from "../index.js";
import { sampleModel } from "../sample.js";

const departmentView: ViewDef = {
  id: "department",
  layout: "lane",
  boundary: "department",
  normalForm: "responsibilityBoundary",
};

function scopedProcessModel(model: ProcessModel, leafIds: readonly Id[]): ProcessModel {
  const include = new Set(leafIds);
  const activities: Record<Id, (typeof model.activities)[Id]> = {};
  for (const id of leafIds) {
    const activity = model.activities[id];
    if (activity) activities[id] = activity;
  }
  const flows = model.flows.filter((flow) => include.has(flow.from) && include.has(flow.to));
  return { schemaVersion: model.schemaVersion, activities, flows };
}

test("sample has an implementation-loop drill-down scope without changing the root leaf set", () => {
  assert.deepEqual(sampleModel.activities.implementation_loop?.children, [
    "implementation",
    "self_review",
    "code_review",
    "fix",
  ]);

  assert.deepEqual(leafActivityIds(sampleModel, "software_development"), [
    "issue_triage",
    "requirements",
    "design",
    "design_review",
    "implementation",
    "self_review",
    "code_review",
    "fix",
    "test",
    "bug_report",
    "bug_fix",
    "retest",
    "release",
  ]);
});

test("drill-down projection uses the selected scope leaves", () => {
  const scoped = scopedProcessModel(
    sampleModel,
    leafActivityIds(sampleModel, "implementation_loop"),
  );
  const projected = projectByResponsibilityBoundary(scoped, departmentView);

  assert.deepEqual(
    projected.activities.flatMap((activity) =>
      activity.kind === "atomic" ? [activity.activityId] : [...activity.activityIds],
    ),
    ["implementation", "self_review", "code_review", "fix"],
  );
  assert.deepEqual(
    projected.activities.map((activity) => activity.boundary),
    ["開発部"],
  );
});

test("a non-contiguous drill-down scope is rejected by v0 linear projection", () => {
  const invalid: ProcessModel = {
    schemaVersion: "responsible.v0",
    activities: {
      root: { id: "root", input: "A", output: "D", children: ["scope"] },
      scope: { id: "scope", input: "A", output: "D", children: ["a", "c"] },
      a: { id: "a", input: "A", output: "B", responsibility: { department: "one" } },
      b: { id: "b", input: "B", output: "C", responsibility: { department: "two" } },
      c: { id: "c", input: "C", output: "D", responsibility: { department: "three" } },
    },
    flows: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ],
  };

  const scoped = scopedProcessModel(invalid, leafActivityIds(invalid, "scope"));

  assert.throws(
    () => projectByResponsibilityBoundary(scoped, departmentView),
    /exactly one start|connected linear flow/,
  );
});
