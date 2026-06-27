/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import { projectByResponsibilityBoundary } from "../index.js";
import { buildLaneHierarchy } from "../viewer/buildLaneHierarchy.js";
import { layoutHierarchy } from "../viewer/layoutHierarchy.js";
import type { ProcessModel, ViewDef } from "../model.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeModel(
  activities: { id: string; company: string; department: string; team: string }[],
  flowPairs: [string, string][],
): ProcessModel {
  const acts: ProcessModel["activities"] = {};
  for (const a of activities) {
    acts[a.id] = {
      id: a.id,
      input: "X",
      output: "Y",
      responsibility: { company: a.company, department: a.department, section: "S", team: a.team, person: a.id },
    };
  }
  return {
    schemaVersion: "responsible.v0",
    activities: acts,
    flows: flowPairs.map(([from, to]) => ({ from, to })),
  };
}

function project(model: ProcessModel, zoomLevel: number) {
  const KEYS = ["company", "department", "section", "team", "person"] as const;
  const boundary = KEYS.slice(0, zoomLevel + 1);
  const view: ViewDef = { id: "v", layout: "lane", boundary, normalForm: "responsibilityBoundary" };
  return projectByResponsibilityBoundary(model, view);
}

// ── regression: A→B→A→B cross-lane flow order ────────────────────────────────

test("A→B→A→B: activities maintain global flow order on x-axis across lanes", () => {
  // lane T1 has activities at flowIndex 0 and 2; lane T2 has 1 and 3
  const model = makeModel(
    [
      { id: "a", company: "Acme", department: "Dept", team: "T1" },
      { id: "b", company: "Acme", department: "Dept", team: "T2" },
      { id: "c", company: "Acme", department: "Dept", team: "T1" },
      { id: "d", company: "Acme", department: "Dept", team: "T2" },
    ],
    [["a", "b"], ["b", "c"], ["c", "d"]],
  );

  const zoomLevel = 3; // team
  const view = project(model, zoomLevel);

  // At team level with path boundary, no two consecutive activities share the same
  // full path, so all 4 activities project individually.
  assert.equal(view.activities.length, 4, "all 4 activities must remain distinct at team level");

  const hierarchy = buildLaneHierarchy(view, model.activities, zoomLevel);
  const layout = layoutHierarchy(hierarchy, model.activities);

  // Extract the x position for each activity in order [a, b, c, d]
  const xs = view.activities.map((act) => {
    const lo = layout.activityLayouts.get(act.id);
    assert.ok(lo, `layout missing for ${act.id}`);
    return lo!.x;
  });

  // x must be strictly increasing: flow order = left-to-right
  for (let i = 1; i < xs.length; i++) {
    assert.ok(
      xs[i]! > xs[i - 1]!,
      `x[${i}]=${xs[i]} must be greater than x[${i - 1}]=${xs[i - 1]} (flow order broken)`,
    );
  }
});

// ── regression: same-named team under different departments ──────────────────

test("same team name under different departments are kept separate in projection", () => {
  // Two departments each have a team named "Dev". Without path boundary they
  // would be merged; with path boundary they must stay distinct.
  const model = makeModel(
    [
      { id: "a", company: "Acme", department: "Dept1", team: "Dev" },
      { id: "b", company: "Acme", department: "Dept2", team: "Dev" },
    ],
    [["a", "b"]],
  );

  const zoomLevel = 3; // team
  const view = project(model, zoomLevel);

  // Both activities must remain atomic (different full paths → no compositing)
  assert.equal(view.activities.length, 2, "activities in same-named teams under different depts must not be merged");
  assert.equal(view.activities[0]!.kind, "atomic");
  assert.equal(view.activities[1]!.kind, "atomic");

  // They must end up in different leaf lanes
  const hierarchy = buildLaneHierarchy(view, model.activities, zoomLevel);
  const parentA = hierarchy.activityParentId.get(view.activities[0]!.id);
  const parentB = hierarchy.activityParentId.get(view.activities[1]!.id);
  assert.notEqual(parentA, parentB, "same-named teams under different depts must be in different lanes");
});
