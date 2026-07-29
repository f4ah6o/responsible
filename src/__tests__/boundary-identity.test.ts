import { test } from "node:test";
import assert from "node:assert/strict";

import {
  boundaryOfResponsibility,
  decodeBoundaryId,
  displayBoundaryValue,
  projectDagByResponsibilityBoundary,
} from "../index.js";
import { buildLaneHierarchy, laneIdForBoundary } from "../viewer/buildLaneHierarchy.js";
import type { ProcessModel, Responsibility, ViewDef } from "../model.js";
import { projectionToFlow } from "../viewer/projectionToFlow.js";

const view: ViewDef = {
  id: "v",
  layout: "lane",
  boundary: ["company", "department"],
  normalForm: "responsibilityBoundary",
};

test("typed boundary values never share an identity", () => {
  const values: readonly unknown[] = ["true", true, "1", 1, "[a,b]", ["a", "b"]];
  const ids = values.map((value) =>
    boundaryOfResponsibility({ team: value as never } as Responsibility, "team"),
  );
  assert.equal(new Set(ids).size, values.length);
});

test("multi-axis boundary codec round-trips delimiter-heavy keys and values", () => {
  const responsibility = {
    "team|name": "a:b|c/d,%+",
    "region:code": ["{x}", "a,b"],
  } as const;
  const boundary = ["team|name", "region:code"] as const;
  const encoded = boundaryOfResponsibility(responsibility, boundary);
  const decoded = decodeBoundaryId(encoded);

  assert.deepEqual(
    decoded.map((part) => [part.key, part.value]),
    [
      ["team|name", "a:b|c/d,%+"],
      ["region:code", ["{x}", "a,b"]],
    ],
  );
  assert.equal(displayBoundaryValue(decoded[0]?.value), "a:b|c/d,%+");
});

test("single-axis delimiter-heavy values remain unambiguous", () => {
  const encoded = boundaryOfResponsibility({ team: "A|B:D" }, "team");

  assert.deepEqual(decodeBoundaryId(encoded), [{ value: "A|B:D" }]);
});

test("viewer lanes use the same structured identity as projected boundaries", () => {
  const model: ProcessModel = {
    schemaVersion: "responsible.v0",
    activities: {
      a: {
        id: "a",
        input: "I",
        output: "M",
        responsibility: { company: "A|B", department: "D:C" },
      },
      b: {
        id: "b",
        input: "M",
        output: "O",
        responsibility: { company: "A|B", department: "D:C" },
      },
    },
    flows: [{ from: "a", to: "b" }],
  };
  const projected = projectDagByResponsibilityBoundary(model, view);
  const hierarchy = buildLaneHierarchy(projected, model.activities, 1);
  const target = boundaryOfResponsibility({ company: "A|B", department: "D:C" }, view.boundary);
  const targetLane = laneIdForBoundary(target, ["company", "department"]);

  assert.equal(hierarchy.roots.length, 1);
  assert.equal(hierarchy.roots[0]?.children.length, 1);
  assert.equal(hierarchy.activityParentId.get(projected.activities[0]!.id), targetLane);
});

test("lane node ids cannot collide with projected activity ids", () => {
  const activityId = "lane:company:A";
  const model: ProcessModel = {
    schemaVersion: "responsible.v0",
    activities: {
      [activityId]: {
        id: activityId,
        input: "I",
        output: "O",
        responsibility: { company: "A" },
      },
    },
    flows: [],
  };
  const oneAxisView: ViewDef = { ...view, boundary: "company" };
  const projected = projectDagByResponsibilityBoundary(model, oneAxisView);
  const flow = projectionToFlow(projected, model.activities, undefined, 0);
  const ids = flow.nodes.map((node) => node.id);

  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.includes(activityId), true);
});
