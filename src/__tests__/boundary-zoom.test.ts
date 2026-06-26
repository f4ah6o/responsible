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
import { rootActivityId, sampleModel, sampleProcesses } from "./../../src/sample.js";

const EXPECTED_PROJECTION_BOUNDARIES: Record<string, string[]> = {
  company: ["あかつきソフトウェア"],
  department: ["プロダクト部", "開発部", "品質保証部", "開発部", "品質保証部", "基盤部"],
  section: ["プロダクト管理課", "アーキテクチャ課", "アプリケーション課", "QA課", "アプリケーション課", "QA課", "リリース管理課"],
  team: ["トリアージチーム", "設計チーム", "機能開発チーム", "テストチーム", "機能開発チーム", "テストチーム", "運用チーム"],
  person: ["佐藤", "鈴木", "渡辺", "高橋", "田中", "高橋", "伊藤", "高橋", "伊藤", "小林"],
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

test("each hierarchical level projection sequence matches the expected flow order", () => {
  for (const [boundary, expected] of Object.entries(EXPECTED_PROJECTION_BOUNDARIES)) {
    assert.deepEqual(
      projectedBoundarySequence(boundary),
      expected,
      `projection sequence mismatch at level ${boundary}`,
    );
  }
});

test("person level produces fewer nodes than leaves because some consecutive leaves share a person", () => {
  const sequence = projectedBoundarySequence("person");
  const leaves = leafIdsUnder(sampleModel, rootActivityId);
  assert.ok(sequence.length <= leaves.length, "person-level nodes must not exceed leaf count");
  assert.ok(sequence.length > 0, "person-level must have at least one node");
});

test("zooming one step down expands a collapsed run: company has 1 node, department has 6 nodes, section has 7", () => {
  assert.equal(projectedBoundarySequence("company").length, 1);
  assert.equal(projectedBoundarySequence("department").length, 6);
  assert.equal(projectedBoundarySequence("section").length, 7);
});

test("every sample is v0-linear and collapses to one node at company while expanding at department", () => {
  for (const sample of sampleProcesses) {
    const leaves = leafIdsUnder(sample.model, sample.rootActivityId);
    const scoped = scopedProcessModel(sample.model, leaves);

    for (const boundary of HIERARCHICAL_BOUNDARY_ORDER) {
      const view: ViewDef = {
        id: "current",
        layout: "lane",
        boundary,
        normalForm: "responsibilityBoundary",
      };
      const projected = projectByResponsibilityBoundary(scoped, view);
      assert.equal(
        projected.activities.length <= leaves.length,
        true,
        `${sample.id}: level ${boundary} produced more projected nodes than leaves`,
      );
      assert.equal(
        isResponsibilityBoundaryNormalForm(projected),
        true,
        `${sample.id}: RBNF broken at level ${boundary}`,
      );
    }

    const companyView: ViewDef = {
      id: "current",
      layout: "lane",
      boundary: "company",
      normalForm: "responsibilityBoundary",
    };
    const departmentView: ViewDef = {
      id: "current",
      layout: "lane",
      boundary: "department",
      normalForm: "responsibilityBoundary",
    };
    assert.equal(
      projectByResponsibilityBoundary(scoped, companyView).activities.length,
      1,
      `${sample.id}: company should collapse to a single node`,
    );
    assert.ok(
      projectByResponsibilityBoundary(scoped, departmentView).activities.length > 1,
      `${sample.id}: department should expand to multiple nodes`,
    );
  }
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
