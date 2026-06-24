/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  type ProcessModel,
  type ViewDef,
  isResponsibilityBoundaryNormalForm,
  projectByResponsibilityBoundary,
} from "../index.js";

const view: ViewDef = {
  id: "team_view",
  layout: "lane",
  boundary: "team",
  normalForm: "responsibilityBoundary",
};

function activities(
  ...ids: string[]
): Record<string, { id: string; input: string; output: string; responsibility: { team: string } }> {
  const result: Record<
    string,
    { id: string; input: string; output: string; responsibility: { team: string } }
  > = {};
  for (const id of ids) {
    result[id] = { id, input: "X", output: "Y", responsibility: { team: "t" } };
  }
  return result;
}

function model(
  acts: Record<
    string,
    { id: string; input: string; output: string; responsibility: { team: string } }
  >,
  flows: { from: string; to: string }[],
): ProcessModel {
  return { schemaVersion: "responsible.v0", activities: acts, flows };
}

test("v0 rejects branching (multiple outgoing edges)", () => {
  assert.throws(
    () =>
      projectByResponsibilityBoundary(
        model(activities("a", "b", "c"), [
          { from: "a", to: "b" },
          { from: "a", to: "c" },
        ]),
        view,
      ),
    /linear flows only/,
  );
});

test("v0 rejects merging (multiple incoming edges)", () => {
  assert.throws(
    () =>
      projectByResponsibilityBoundary(
        model(activities("a", "b", "c"), [
          { from: "a", to: "c" },
          { from: "b", to: "c" },
        ]),
        view,
      ),
    /linear flows only/,
  );
});

test("v0 rejects a cyclic flow", () => {
  assert.throws(
    () =>
      projectByResponsibilityBoundary(
        model(activities("a", "b"), [
          { from: "a", to: "b" },
          { from: "b", to: "a" },
        ]),
        view,
      ),
    /v0 projection/,
  );
});

test("v0 rejects multiple start activities", () => {
  assert.throws(
    () =>
      projectByResponsibilityBoundary(
        model(activities("a", "b", "c", "d"), [
          { from: "a", to: "b" },
          { from: "c", to: "d" },
        ]),
        view,
      ),
    /exactly one start/,
  );
});

test("v0 rejects disconnected flows", () => {
  assert.throws(
    () =>
      projectByResponsibilityBoundary(
        model(activities("a", "b", "c", "d"), [
          { from: "a", to: "b" },
          { from: "c", to: "d" },
          { from: "d", to: "c" },
        ]),
        view,
      ),
    /one connected linear flow/,
  );
});

test("a linear flow with a boundary change produces a normal-form view", () => {
  const linear: ProcessModel = {
    schemaVersion: "responsible.v0",
    activities: {
      a: { id: "a", input: "In", output: "M", responsibility: { team: "sales" } },
      b: { id: "b", input: "M", output: "N", responsibility: { team: "sales" } },
      c: { id: "c", input: "N", output: "Out", responsibility: { team: "eng" } },
    },
    flows: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ],
  };

  const projected = projectByResponsibilityBoundary(linear, view);

  assert.equal(projected.activities.length, 2);
  assert.equal(isResponsibilityBoundaryNormalForm(projected), true);
});
