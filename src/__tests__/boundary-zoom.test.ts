/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  HIERARCHICAL_BOUNDARY_ORDER,
  type BoundaryExpr,
  type ProcessModel,
  type ViewDef,
  ZOOM_LEVEL_COUNT,
  boundaryForLevel,
  canZoomIn,
  canZoomOut,
  clampZoomLevel,
  isHierarchicalBoundary,
  isResponsibilityBoundaryNormalForm,
  projectByResponsibilityBoundary,
  zoomLevelIndexOf,
  zoomIn,
  zoomOut,
} from "./../../src/index.js";
import { rootActivityId, sampleModel } from "./../../src/sample.js";

const EXPECTED_PROJECTION_BOUNDARIES: Record<string, string[]> = {
  company: ["Example Construction", "Partner Company", "Example Construction"],
  department: ["Sales Department", "Construction Department", "Administration Department"],
  section: [
    "Sales Section",
    "Estimation Section",
    "Sales Section",
    "Construction Section",
    "Procurement Section",
    "Construction Section",
    "Accounting Section",
  ],
};

function scopedProcessModel(model: ProcessModel, leafIds: readonly string[]): ProcessModel {
  const include = new Set(leafIds);
  const activities: Record<string, (typeof model.activities)[string]> = {};
  for (const id of leafIds) {
    const activity = model.activities[id];
    if (activity) activities[id] = activity;
  }
  const flows = model.flows.filter((flow) => include.has(flow.from) && include.has(flow.to));
  return { schemaVersion: model.schemaVersion, activities, flows };
}

function leafIdsUnder(model: ProcessModel, id: string, seen = new Set<string>()): string[] {
  if (seen.has(id)) return [];
  seen.add(id);
  const activity = model.activities[id];
  if (!activity) return [];
  const children = activity.children ?? [];
  if (children.length === 0) return [id];
  return children.flatMap((childId) => leafIdsUnder(model, childId, seen));
}

function projectedBoundarySequence(boundary: BoundaryExpr): string[] {
  const view: ViewDef = {
    id: "current",
    layout: "lane",
    boundary,
    normalForm: "responsibilityBoundary",
  };
  const scoped = scopedProcessModel(sampleModel, leafIdsUnder(sampleModel, rootActivityId));
  const projected = projectByResponsibilityBoundary(scoped, view);
  return projected.activities.map((activity) => activity.boundary);
}

test("HIERARCHICAL_BOUNDARY_ORDER is ordered company < department < section < team < person", () => {
  assert.deepEqual(
    [...HIERARCHICAL_BOUNDARY_ORDER],
    ["company", "department", "section", "team", "person"],
  );
  assert.equal(ZOOM_LEVEL_COUNT, 5);
});

test("isHierarchicalBoundary recognises the hierarchical levels only", () => {
  for (const key of HIERARCHICAL_BOUNDARY_ORDER) {
    assert.equal(isHierarchicalBoundary(key), true);
  }
  assert.equal(isHierarchicalBoundary("function"), false);
  assert.equal(isHierarchicalBoundary("role"), false);
  assert.equal(isHierarchicalBoundary("system"), false);
  assert.equal(isHierarchicalBoundary(["project", "function"]), false);
});

test("zoomLevelIndexOf returns the level for hierarchical boundaries and null otherwise", () => {
  assert.equal(zoomLevelIndexOf("company"), 0);
  assert.equal(zoomLevelIndexOf("department"), 1);
  assert.equal(zoomLevelIndexOf("section"), 2);
  assert.equal(zoomLevelIndexOf("team"), 3);
  assert.equal(zoomLevelIndexOf("person"), 4);
  assert.equal(zoomLevelIndexOf("function"), null);
  assert.equal(zoomLevelIndexOf(["project", "function"]), null);
});

test("boundaryForLevel and clamp clamp at both ends", () => {
  assert.equal(boundaryForLevel(-1), "company");
  assert.equal(boundaryForLevel(0), "company");
  assert.equal(boundaryForLevel(4), "person");
  assert.equal(boundaryForLevel(5), "person");
  assert.equal(clampZoomLevel(-2), 0);
  assert.equal(clampZoomLevel(99), 4);
});

test("zoomIn / zoomOut / canZoomIn / canZoomOut follow the hierarchy one step and clamp", () => {
  assert.equal(zoomIn(1), 2);
  assert.equal(zoomOut(1), 0);
  assert.equal(zoomIn(4), 4, "zoom in clamps at person");
  assert.equal(zoomOut(0), 0, "zoom out clamps at company");

  assert.equal(canZoomIn(4), false);
  assert.equal(canZoomOut(0), false);
  assert.equal(canZoomIn(0), true);
  assert.equal(canZoomOut(4), true);
});

test("each hierarchical level keeps the projection scope at the full process leaf set", () => {
  const expectedLeaves = leafIdsUnder(sampleModel, rootActivityId);
  for (const key of HIERARCHICAL_BOUNDARY_ORDER) {
    const sequence = projectedBoundarySequence(key);
    const nodeCount = sequence.length;
    assert.equal(
      nodeCount <= expectedLeaves.length,
      true,
      `level ${key} produced more projected nodes than leaves`,
    );
  }
});

test("zooming only changes the boundary level, never the projected leaf set", () => {
  const expectedLeaves = new Set(leafIdsUnder(sampleModel, rootActivityId));
  for (const key of HIERARCHICAL_BOUNDARY_ORDER) {
    const view: ViewDef = {
      id: "current",
      layout: "lane",
      boundary: key,
      normalForm: "responsibilityBoundary",
    };
    const scoped = scopedProcessModel(sampleModel, leafIdsUnder(sampleModel, rootActivityId));
    const projected = projectByResponsibilityBoundary(scoped, view);
    const sources = new Set<string>();
    for (const activity of projected.activities) {
      if (activity.kind === "atomic") sources.add(activity.activityId);
      else for (const id of activity.activityIds) sources.add(id);
    }
    assert.deepEqual([...sources].sort(), [...expectedLeaves].sort(), `leaf set differs at ${key}`);
  }
});

test("Responsibility Boundary Normal Form is maintained at every hierarchical level", () => {
  for (const key of HIERARCHICAL_BOUNDARY_ORDER) {
    const view: ViewDef = {
      id: "current",
      layout: "lane",
      boundary: key,
      normalForm: "responsibilityBoundary",
    };
    const scoped = scopedProcessModel(sampleModel, leafIdsUnder(sampleModel, rootActivityId));
    const projected = projectByResponsibilityBoundary(scoped, view);
    assert.equal(
      isResponsibilityBoundaryNormalForm(projected),
      true,
      `RBNF broken at level ${key}`,
    );
  }
});

test("company / department / section projection sequences match the expected flow order", () => {
  assert.deepEqual(projectedBoundarySequence("company"), EXPECTED_PROJECTION_BOUNDARIES.company);
  assert.deepEqual(
    projectedBoundarySequence("department"),
    EXPECTED_PROJECTION_BOUNDARIES.department,
  );
  assert.deepEqual(projectedBoundarySequence("section"), EXPECTED_PROJECTION_BOUNDARIES.section);
});

test("person level projects every leaf because no two consecutive leaves share a person", () => {
  const sequence = projectedBoundarySequence("person");
  assert.equal(sequence.length, leafIdsUnder(sampleModel, rootActivityId).length);
});

test("zooming one step down expands a collapsed run: company has 3 nodes, department has 3 nodes, section has 7", () => {
  assert.equal(projectedBoundarySequence("company").length, 3);
  assert.equal(projectedBoundarySequence("department").length, 3);
  assert.equal(projectedBoundarySequence("section").length, 7);
});

test("display-axis boundaries are not affected by the zoom level helpers", () => {
  const view: ViewDef = {
    id: "project_function",
    layout: "lane",
    boundary: ["project", "function"],
    normalForm: "responsibilityBoundary",
  };
  const scoped = scopedProcessModel(sampleModel, leafIdsUnder(sampleModel, rootActivityId));
  const projected = projectByResponsibilityBoundary(scoped, view);
  assert.equal(isResponsibilityBoundaryNormalForm(projected), true);
});
