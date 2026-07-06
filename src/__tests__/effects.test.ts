import { test } from "node:test";
import assert from "node:assert/strict";

import { type ProcessModel, projectEffects } from "../index.js";

// Two-axis (company + role) version of the docs/activity-effects.md example,
// so the same directed effect crosses the role boundary but is internal at
// the company boundary.
const model: ProcessModel = {
  schemaVersion: "responsible.v1",
  activities: {
    root: {
      id: "root",
      input: "DraftApplication",
      output: "ApprovedApplication",
      children: ["submit", "approve"],
    },
    submit: {
      id: "submit",
      input: "DraftApplication",
      output: "SubmittedApplication",
      responsibility: { company: "Acme", role: "Applicant" },
      ensures: ["Application.status = submitted"],
      effects: [
        {
          payload: { kind: "command", schema: "ApprovalRequest" },
          delivery: { mode: "directed", target: { company: "Acme", role: "Manager" } },
        },
      ],
    },
    approve: {
      id: "approve",
      input: "SubmittedApplication",
      output: "ApprovedApplication",
      responsibility: { company: "Acme", role: "Manager" },
      ensures: ["Application.status = approved"],
      effects: [
        {
          payload: { kind: "domain-fact", schema: "ApprovalResult" },
          delivery: { mode: "broadcast" },
        },
      ],
    },
  },
  flows: [{ from: "submit", to: "approve" }],
};

function okEffects(result: ReturnType<typeof projectEffects>) {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  return result.effects;
}

test("projectEffects derives the source from the declaring activity", () => {
  const effects = okEffects(projectEffects(model, "role"));
  const directed = effects.find((effect) => effect.delivery.mode === "directed");
  assert.deepEqual(directed?.source, { activityId: "submit", boundary: "Applicant" });
  assert.deepEqual(directed?.payload, { kind: "command", schema: "ApprovalRequest" });
});

test("projectEffects resolves a directed target with the boundaryOf rule", () => {
  const effects = okEffects(projectEffects(model, "role"));
  const directed = effects.find((effect) => effect.delivery.mode === "directed");
  assert.deepEqual(directed?.delivery, { mode: "directed", target: "Manager" });

  const composite = okEffects(projectEffects(model, ["company", "role"]));
  const compositeDirected = composite.find((effect) => effect.delivery.mode === "directed");
  assert.deepEqual(compositeDirected?.delivery, {
    mode: "directed",
    target: "company:Acme|role:Manager",
  });
});

test("a directed effect internal at a coarse boundary is hidden (tau)", () => {
  // At the company boundary source and target both resolve to "Acme".
  const effects = okEffects(projectEffects(model, "company"));
  assert.equal(
    effects.some((effect) => effect.delivery.mode === "directed"),
    false,
  );
  // At the role boundary the same effect crosses and is visible.
  const roleEffects = okEffects(projectEffects(model, "role"));
  assert.equal(
    roleEffects.some((effect) => effect.delivery.mode === "directed"),
    true,
  );
});

test("broadcast effects are retained at every boundary", () => {
  for (const boundary of ["company", "role"] as const) {
    const effects = okEffects(projectEffects(model, boundary));
    assert.equal(
      effects.some(
        (effect) => effect.delivery.mode === "broadcast" && effect.source.activityId === "approve",
      ),
      true,
    );
  }
});

test("an unknown directed target is reported as an INV-3 violation", () => {
  const broken: ProcessModel = {
    ...model,
    activities: {
      ...model.activities,
      submit: {
        ...model.activities["submit"]!,
        effects: [
          {
            payload: { kind: "command", schema: "AuditRequest" },
            delivery: { mode: "directed", target: { role: "Auditor" } },
          },
        ],
      },
    },
  };
  const result = projectEffects(broken, "role");
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.issues[0]?.path, "$.activities.submit.effects[0].delivery.target");
  assert.match(result.issues[0]?.message ?? "", /INV-3/);
});

test("projectEffects respects the drill-down scope", () => {
  const effects = okEffects(projectEffects(model, "role", "submit"));
  assert.deepEqual(
    effects.map((effect) => effect.source.activityId),
    ["submit"],
  );
});

test("projectEffects does not mutate the model (INV-1)", () => {
  const before = JSON.stringify(model);
  projectEffects(model, "role");
  projectEffects(model, "company");
  assert.equal(JSON.stringify(model), before);
});

test("a v0 model yields no effects", () => {
  const v0Model: ProcessModel = {
    schemaVersion: "responsible.v0",
    activities: {
      a: { id: "a", input: "X", output: "Y", responsibility: { team: "sales" } },
    },
    flows: [],
  };
  const effects = okEffects(projectEffects(v0Model, "team"));
  assert.deepEqual(effects, []);
});
