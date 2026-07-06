import { test } from "node:test";
import assert from "node:assert/strict";

import {
  type ProcessModel,
  migrateProcessModelToV1,
  parseProcessModelJson,
  projectByResponsibilityBoundary,
  validateProcessModel,
} from "../index.js";

// The running example of docs/activity-effects.md as a responsible.v1 document.
const v1Model = {
  schemaVersion: "responsible.v1",
  activities: {
    submit: {
      id: "submit",
      name: "申請を提出する",
      input: "DraftApplication",
      output: "SubmittedApplication",
      responsibility: { role: "Applicant" },
      requires: ["Application.status = draft", "RequiredFields = complete"],
      ensures: ["Application.status = submitted", "SubmissionFact(Application, Applicant) = true"],
      effects: [
        {
          payload: { kind: "command", schema: "ApprovalRequest" },
          delivery: { mode: "directed", target: { role: "Manager" } },
        },
      ],
    },
    approve: {
      id: "approve",
      name: "申請を承認する",
      input: "SubmittedApplication",
      output: "ApprovedApplication",
      responsibility: { role: "Manager" },
      requires: ["Application.status = submitted"],
      ensures: ["Application.status = approved"],
      effects: [
        {
          id: "approval-result",
          payload: { kind: "domain-fact", schema: "ApprovalResult" },
          delivery: { mode: "broadcast" },
        },
        {
          payload: { kind: "data", schema: "ApprovalLog" },
          delivery: { mode: "observable" },
        },
      ],
    },
  },
  flows: [{ from: "submit", to: "approve" }],
};

function issuePaths(value: unknown): string[] {
  const result = validateProcessModel(value);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  return result.issues.map((issue) => issue.path);
}

test("validateProcessModel accepts a responsible.v1 model with contracts and effects", () => {
  const result = validateProcessModel(v1Model);
  assert.equal(result.ok, true);
});

test("parseProcessModelJson round-trips a responsible.v1 model", () => {
  const result = parseProcessModelJson(JSON.stringify(v1Model));
  assert.equal(result.ok, true);
});

test("v1 fields are rejected in a responsible.v0 document with a version hint", () => {
  const paths = issuePaths({ ...v1Model, schemaVersion: "responsible.v0" });
  assert.equal(paths.includes("$.activities.submit.requires"), true);
  assert.equal(paths.includes("$.activities.submit.ensures"), true);
  assert.equal(paths.includes("$.activities.submit.effects"), true);
});

test("validateProcessModel reports malformed requires / ensures entries", () => {
  const paths = issuePaths({
    ...v1Model,
    activities: {
      ...v1Model.activities,
      submit: { ...v1Model.activities.submit, requires: ["", 42], ensures: "not an array" },
    },
  });
  assert.equal(paths.includes("$.activities.submit.requires[0]"), true);
  assert.equal(paths.includes("$.activities.submit.requires[1]"), true);
  assert.equal(paths.includes("$.activities.submit.ensures"), true);
});

test("validateProcessModel reports malformed effect payloads and deliveries", () => {
  const paths = issuePaths({
    ...v1Model,
    activities: {
      ...v1Model.activities,
      submit: {
        ...v1Model.activities.submit,
        effects: [
          { payload: { kind: "event", schema: "" }, delivery: { mode: "unicast" } },
          { id: "", payload: "not an object", delivery: { mode: "directed" } },
          {
            payload: { kind: "command", schema: "X" },
            delivery: { mode: "directed", target: {} },
          },
        ],
      },
    },
  });
  assert.equal(paths.includes("$.activities.submit.effects[0].payload.kind"), true);
  assert.equal(paths.includes("$.activities.submit.effects[0].payload.schema"), true);
  assert.equal(paths.includes("$.activities.submit.effects[0].delivery.mode"), true);
  assert.equal(paths.includes("$.activities.submit.effects[1].id"), true);
  assert.equal(paths.includes("$.activities.submit.effects[1].payload"), true);
  assert.equal(paths.includes("$.activities.submit.effects[1].delivery.target"), true);
  assert.equal(paths.includes("$.activities.submit.effects[2].delivery.target"), true);
});

test("migrateProcessModelToV1 rewrites only the schemaVersion", () => {
  const v0Model: ProcessModel = {
    schemaVersion: "responsible.v0",
    activities: {
      a: { id: "a", input: "X", output: "Y", responsibility: { team: "sales" } },
    },
    flows: [],
  };
  const migrated = migrateProcessModelToV1(v0Model);
  assert.equal(migrated.schemaVersion, "responsible.v1");
  assert.equal(migrated.activities, v0Model.activities);
  assert.equal(migrated.flows, v0Model.flows);
  // The source model is not mutated (INV-1).
  assert.equal(v0Model.schemaVersion, "responsible.v0");
  // The result of a schemaVersion-only rewrite is a valid v1 document.
  assert.equal(validateProcessModel(migrated).ok, true);
});

test("migrateProcessModelToV1 is idempotent on v1 models", () => {
  const model = v1Model as unknown as ProcessModel;
  assert.equal(migrateProcessModelToV1(model), model);
});

test("flow projection is version-agnostic for v1 models", () => {
  const view = projectByResponsibilityBoundary(v1Model as unknown as ProcessModel, {
    id: "v",
    layout: "lane",
    boundary: "role",
    normalForm: "responsibilityBoundary",
  });
  assert.deepEqual(
    view.activities.map((activity) => activity.boundary),
    ["Applicant", "Manager"],
  );
});
