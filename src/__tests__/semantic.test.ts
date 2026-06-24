import { test } from "node:test";
import assert from "node:assert/strict";

import {
  type ActivityId,
  type BoundaryId,
  type Effect,
  type EnsuresRef,
  type Projection,
  type RBNF,
  type RequiresRef,
  type SchemaRef,
  knownBoundaryIds,
  leafActivityIds,
  validateDirectedEffect,
  type ProcessModel,
  type ProcessView,
} from "../index.js";

const modelWithParent: ProcessModel = {
  schemaVersion: "responsible.v0",
  activities: {
    parent: { id: "parent", input: "X", output: "Z", children: ["a", "b"] },
    a: { id: "a", input: "X", output: "Y", responsibility: { team: "sales" } },
    b: { id: "b", input: "Y", output: "Z", responsibility: { team: "sales" } },
    c: { id: "c", input: "Z", output: "W", responsibility: { team: "eng" } },
  },
  flows: [],
};

test("semantic vocabulary types are exported and assignable", () => {
  const activityId: ActivityId = "a";
  const boundaryId: BoundaryId = "sales";
  const schemaRef: SchemaRef = "responsible.v0/Order";
  const projection: Projection = "responsibilityBoundary";
  const requiresRef: RequiresRef = "requires/has-order";
  const ensuresRef: EnsuresRef = "ensures/order-placed";

  assert.equal(activityId, "a");
  assert.equal(boundaryId, "sales");
  assert.equal(schemaRef, "responsible.v0/Order");
  assert.equal(projection, "responsibilityBoundary");
  assert.equal(requiresRef, "requires/has-order");
  assert.equal(ensuresRef, "ensures/order-placed");
});

test("Effect is plain JSON-serializable data", () => {
  const effect: Effect = {
    source: { activityId: "a", boundary: "sales" },
    payload: { kind: "domain-fact", schema: "responsible.v0/Estimate" },
    delivery: { mode: "directed", target: "eng" },
  };

  const roundTripped = JSON.parse(JSON.stringify(effect)) as Effect;

  assert.deepEqual(roundTripped, effect);
  assert.equal(roundTripped.delivery.mode, "directed");
});

test("RBNF is an alias of ProcessView", () => {
  const view: RBNF = {
    view: {
      id: "v",
      layout: "lane",
      boundary: "team",
      normalForm: "responsibilityBoundary",
    },
    activities: [],
    flows: [],
  };

  const alsoView: ProcessView = view;

  assert.equal(alsoView.activities.length, 0);
});

test("knownBoundaryIds projects leaf activities only", () => {
  const ids = knownBoundaryIds(modelWithParent, "team");

  assert.equal(ids.has("sales"), true);
  assert.equal(ids.has("eng"), true);
  assert.equal(ids.size, 2);
});

test("knownBoundaryIds with composite boundary expression", () => {
  const model: ProcessModel = {
    schemaVersion: "responsible.v0",
    activities: {
      a: {
        id: "a",
        input: "X",
        output: "Y",
        responsibility: { team: "sales", region: "jp" },
      },
      b: {
        id: "b",
        input: "Y",
        output: "Z",
        responsibility: { team: "eng", region: "us" },
      },
    },
    flows: [],
  };

  const ids = knownBoundaryIds(model, ["team", "region"]);

  assert.equal(ids.has("team:sales|region:jp"), true);
  assert.equal(ids.has("team:eng|region:us"), true);
});

test("leafActivityIds returns all leaves when no scope is given", () => {
  assert.deepEqual(leafActivityIds(modelWithParent), ["a", "b", "c"]);
});

test("leafActivityIds with scope returns leaves under the scope", () => {
  assert.deepEqual(leafActivityIds(modelWithParent, "parent"), ["a", "b"]);
});

test("INV-3: validateDirectedEffect accepts a known directed effect", () => {
  const result = validateDirectedEffect(modelWithParent, "team", {
    source: { activityId: "a", boundary: "sales" },
    payload: { kind: "command", schema: "responsible.v0/Ship" },
    delivery: { mode: "directed", target: "eng" },
  });

  assert.deepEqual(result, { ok: true });
});

test("INV-3: validateDirectedEffect accepts broadcast delivery without target", () => {
  const result = validateDirectedEffect(modelWithParent, "team", {
    source: { activityId: "a", boundary: "sales" },
    payload: { kind: "data", schema: "responsible.v0/Order" },
    delivery: { mode: "broadcast" },
  });

  assert.deepEqual(result, { ok: true });
});

test("INV-3: validateDirectedEffect accepts observable delivery without target", () => {
  const result = validateDirectedEffect(modelWithParent, "team", {
    source: { activityId: "c", boundary: "eng" },
    payload: { kind: "domain-fact", schema: "responsible.v0/Built" },
    delivery: { mode: "observable" },
  });

  assert.deepEqual(result, { ok: true });
});

test("INV-3: validateDirectedEffect rejects an unknown source activityId", () => {
  const result = validateDirectedEffect(modelWithParent, "team", {
    source: { activityId: "missing", boundary: "sales" },
    payload: { kind: "data", schema: "s" },
    delivery: { mode: "broadcast" },
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /unknown source activityId/);
});

test("INV-3: validateDirectedEffect rejects an unknown source boundary", () => {
  const result = validateDirectedEffect(modelWithParent, "team", {
    source: { activityId: "a", boundary: "marketing" },
    payload: { kind: "data", schema: "s" },
    delivery: { mode: "broadcast" },
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /unknown source boundary/);
});

test("INV-3: validateDirectedEffect rejects an unknown directed target boundary", () => {
  const result = validateDirectedEffect(modelWithParent, "team", {
    source: { activityId: "a", boundary: "sales" },
    payload: { kind: "data", schema: "s" },
    delivery: { mode: "directed", target: "marketing" },
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /unknown directed target boundary/);
});
