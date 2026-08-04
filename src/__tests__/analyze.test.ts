import assert from "node:assert/strict";
import { test } from "node:test";

import { analyzeProcessModel } from "../analyze.js";
import type { ProcessModel } from "../model.js";

const model: ProcessModel = {
  schemaVersion: "responsible.v1",
  activities: {
    approve: {
      id: "approve",
      input: "Application",
      output: "Decision",
      responsibility: { company: "Example", department: "Sales" },
      status: "automatable",
      requires: ["application.submitted"],
      ensures: ["decision.recorded"],
      effects: [
        {
          payload: { kind: "command", schema: "NotifyOperations" },
          delivery: { mode: "directed", target: { department: "Operations" } },
        },
      ],
    },
    fulfill: {
      id: "fulfill",
      input: "Decision",
      output: "Receipt",
      responsibility: { company: "Example", department: "Operations" },
      status: "validated",
      requires: ["decision.approved"],
    },
    orphan: {
      id: "orphan",
      input: "None",
      output: "None",
    },
  },
  types: {
    Application: { kind: "primitive" },
    Decision: { kind: "primitive" },
    Receipt: { kind: "primitive" },
    None: { kind: "primitive" },
  },
  flows: [
    { from: "approve", to: "fulfill" },
    { from: "fulfill", to: "approve" },
  ],
};

test("analyzeProcessModel reports semantics beyond control-flow projection", () => {
  const analysis = analyzeProcessModel(model, "department");

  assert.deepEqual(analysis.summary, {
    activities: 3,
    leafActivities: 3,
    compositeActivities: 0,
    flows: 2,
    types: 4,
    views: 0,
    statuses: {
      discovered: 0,
      defined: 0,
      validated: 1,
      automatable: 1,
      unspecified: 1,
    },
  });
  assert.deepEqual(analysis.topology.cycles, [["approve", "fulfill"]]);
  assert.deepEqual(analysis.topology.isolatedActivityIds, ["orphan"]);
  assert.equal(analysis.responsibility.handoffs.length, 2);
  assert.deepEqual(analysis.responsibility.unassignedActivityIds, ["orphan"]);
  assert.deepEqual(analysis.automation.declaredAutomatableActivityIds, ["approve"]);
  assert.deepEqual(analysis.automation.readySignalActivityIds, ["approve"]);
  assert.deepEqual(analysis.automation.gaps, [
    {
      activityId: "fulfill",
      reasons: ["status-not-automatable", "ensures-undeclared"],
    },
    {
      activityId: "orphan",
      reasons: [
        "status-not-automatable",
        "responsibility-unassigned",
        "requires-undeclared",
        "ensures-undeclared",
      ],
    },
  ]);
  assert.deepEqual(analysis.semantics.effects, {
    total: 1,
    byPayloadKind: { "domain-fact": 0, command: 1, data: 0 },
    byDeliveryMode: { directed: 1, broadcast: 0, observable: 0 },
  });
});

test("analyzeProcessModel accepts model-defined composite boundaries", () => {
  const analysis = analyzeProcessModel(model, ["company", "department"]);

  assert.deepEqual(analysis.boundary, ["company", "department"]);
  assert.equal(analysis.responsibility.groups.length, 3);
  assert.match(analysis.responsibility.groups[0]!.label, /company=/);
  assert.deepEqual(analysis.semantics.boundaryKeys, ["company", "department"]);
});
