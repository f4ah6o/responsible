/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  HIERARCHICAL_BOUNDARY_ORDER,
  ensureRootActivity,
  leafActivityIds,
  parseProcessModelJson,
  projectDagByResponsibilityBoundary,
  projectEffects,
} from "../index.js";
import type { ActivityDef, FlowDef, Id, ProcessModel, ViewDef } from "../model.js";
import { sampleProcesses } from "../sample.js";
import { laneIdForBoundary } from "../viewer/buildLaneHierarchy.js";
import { projectionToFlow, type ActivityNodeData } from "../viewer/projectionToFlow.js";

const v1Sample = sampleProcesses.find((sample) => sample.id === "application_approval")!;

function scoped(model: ProcessModel, rootId: Id): ProcessModel {
  const leaves = leafActivityIds(model, rootId);
  const include = new Set(leaves);
  const activities: Record<Id, ActivityDef> = {};
  for (const id of leaves) activities[id] = model.activities[id]!;
  const flows: FlowDef[] = model.flows.filter(
    (flow) => include.has(flow.from) && include.has(flow.to),
  );
  return { schemaVersion: model.schemaVersion, activities, flows };
}

function flowAtZoom(model: ProcessModel, rootId: Id, zoomLevel: number) {
  const boundary = HIERARCHICAL_BOUNDARY_ORDER.slice(0, zoomLevel + 1);
  const view: ViewDef = {
    id: "current",
    layout: "lane",
    boundary,
    normalForm: "responsibilityBoundary",
  };
  const projected = projectDagByResponsibilityBoundary(scoped(model, rootId), view);
  const effectResult = projectEffects(model, boundary, rootId);
  assert.equal(effectResult.ok, true);
  if (!effectResult.ok) throw new Error("unreachable");
  return {
    boundary,
    flow: projectionToFlow(projected, model.activities, undefined, zoomLevel, undefined, [
      ...effectResult.effects,
    ]),
  };
}

test("the v1 sample declares effects and projects them at every zoom level", () => {
  for (const sample of sampleProcesses) {
    for (let zoomLevel = 0; zoomLevel < HIERARCHICAL_BOUNDARY_ORDER.length; zoomLevel++) {
      const boundary = HIERARCHICAL_BOUNDARY_ORDER.slice(0, zoomLevel + 1);
      const result = projectEffects(sample.model, boundary, sample.rootActivityId);
      assert.equal(result.ok, true, `${sample.id}: INV-3 violation at zoom ${zoomLevel}`);
    }
  }
});

test("effect badges are attached to the projected node containing the source leaf", () => {
  const { flow } = flowAtZoom(v1Sample.model, v1Sample.rootActivityId, 1);
  const submitNode = flow.nodes.find((node) => {
    if (node.type !== "activity") return false;
    const data = node.data as ActivityNodeData;
    const activity = data.activity;
    const sourceIds = activity.kind === "atomic" ? [activity.activityId] : activity.activityIds;
    return sourceIds.includes("submit_application");
  });
  assert.notEqual(submitNode, undefined);
  const data = submitNode!.data as ActivityNodeData;
  assert.equal(
    data.effects.some((effect) => effect.payload.schema === "ApprovalRequest"),
    true,
  );
});

test("a directed effect renders as a dashed edge to the target boundary lane", () => {
  const { flow, boundary } = flowAtZoom(v1Sample.model, v1Sample.rootActivityId, 1);
  const targetLaneId = laneIdForBoundary("company:あおい商事|department:管理部", boundary);
  const effectEdge = flow.edges.find(
    (edge) => edge.className === "edge-effect" && edge.label === "ApprovalRequest",
  );
  assert.notEqual(effectEdge, undefined);
  assert.equal(effectEdge!.target, targetLaneId);
  assert.equal(
    flow.nodes.some((node) => node.id === targetLaneId),
    true,
  );
});

test("directed effects hidden as tau at company zoom produce no effect edges", () => {
  const { flow } = flowAtZoom(v1Sample.model, v1Sample.rootActivityId, 0);
  assert.equal(
    flow.edges.some((edge) => edge.className === "edge-effect"),
    false,
  );
  // The broadcast effect is still shown as a badge on its node.
  const approveNode = flow.nodes.find((node) => {
    if (node.type !== "activity") return false;
    const data = node.data as ActivityNodeData;
    return data.effects.some((effect) => effect.delivery.mode === "broadcast");
  });
  assert.notEqual(approveNode, undefined);
});

test("the intra-section directed effect appears only from team zoom onward", () => {
  const atSection = flowAtZoom(v1Sample.model, v1Sample.rootActivityId, 2);
  assert.equal(
    atSection.flow.edges.some((edge) => edge.label === "ReviewNote"),
    false,
  );
  const atTeam = flowAtZoom(v1Sample.model, v1Sample.rootActivityId, 3);
  assert.equal(
    atTeam.flow.edges.some((edge) => edge.label === "ReviewNote"),
    true,
  );
});

test("identical effects merged into one composite are deduplicated into one edge", () => {
  const target = { company: "A", department: "総務" } as const;
  const model: ProcessModel = {
    schemaVersion: "responsible.v1",
    activities: {
      x: {
        id: "x",
        input: "I",
        output: "M",
        responsibility: { company: "A", department: "営業" },
        effects: [
          {
            payload: { kind: "command", schema: "Notify" },
            delivery: { mode: "directed", target },
          },
        ],
      },
      y: {
        id: "y",
        input: "M",
        output: "O",
        responsibility: { company: "A", department: "営業" },
        effects: [
          {
            payload: { kind: "command", schema: "Notify" },
            delivery: { mode: "directed", target },
          },
        ],
      },
      z: {
        id: "z",
        input: "O",
        output: "Z",
        responsibility: { company: "A", department: "総務" },
      },
    },
    flows: [
      { from: "x", to: "y" },
      { from: "y", to: "z" },
    ],
  };
  const boundary = HIERARCHICAL_BOUNDARY_ORDER.slice(0, 2);
  const view: ViewDef = {
    id: "current",
    layout: "lane",
    boundary,
    normalForm: "responsibilityBoundary",
  };
  const projected = projectDagByResponsibilityBoundary(model, view);
  const effectResult = projectEffects(model, boundary);
  assert.equal(effectResult.ok, true);
  if (!effectResult.ok) throw new Error("unreachable");

  const flow = projectionToFlow(projected, model.activities, undefined, 1, undefined, [
    ...effectResult.effects,
  ]);
  assert.equal(flow.edges.filter((edge) => edge.className === "edge-effect").length, 1);
});

test("projectionToFlow without effects keeps the previous shape (v0 compatibility)", () => {
  const v0Sample = sampleProcesses[0]!;
  const boundary = HIERARCHICAL_BOUNDARY_ORDER.slice(0, 2);
  const view: ViewDef = {
    id: "current",
    layout: "lane",
    boundary,
    normalForm: "responsibilityBoundary",
  };
  const projected = projectDagByResponsibilityBoundary(
    scoped(v0Sample.model, v0Sample.rootActivityId),
    view,
  );
  const flow = projectionToFlow(projected, v0Sample.model.activities, undefined, 1);
  assert.equal(
    flow.edges.some((edge) => edge.className === "edge-effect"),
    false,
  );
  for (const node of flow.nodes) {
    if (node.type !== "activity") continue;
    assert.deepEqual((node.data as ActivityNodeData).effects, []);
  }
});

test("the bundled v1 example JSON validates, wraps, and projects effects", () => {
  const text = readFileSync(
    new URL("../../examples/application-approval.v1.json", import.meta.url),
    "utf8",
  );
  const parsed = parseProcessModelJson(text);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("unreachable");

  const rooted = ensureRootActivity(parsed.model);
  const boundary = HIERARCHICAL_BOUNDARY_ORDER.slice(0, 2);
  const result = projectEffects(rooted.model, boundary, rooted.rootActivityId);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  assert.equal(
    result.effects.some(
      (effect) =>
        effect.delivery.mode === "directed" && effect.payload.schema === "ApprovalRequest",
    ),
    true,
  );
});
