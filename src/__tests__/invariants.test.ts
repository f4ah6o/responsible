/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import * as api from "../index.js";
import {
  type ProcessModel,
  type ProcessView,
  type ProjectedActivity,
  type ViewDef,
  boundaryOf,
  isResponsibilityBoundaryNormalForm,
  leafActivityIds,
  projectByResponsibilityBoundary,
} from "../index.js";

const linearModel: ProcessModel = {
  schemaVersion: "responsible.v0",
  activities: {
    a: { id: "a", input: "Inquiry", output: "Estimate", responsibility: { team: "sales" } },
    b: { id: "b", input: "Estimate", output: "Approved", responsibility: { team: "sales" } },
    c: { id: "c", input: "Approved", output: "Plan", responsibility: { team: "eng" } },
  },
  flows: [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
  ],
};

const teamView: ViewDef = {
  id: "team_view",
  layout: "lane",
  boundary: "team",
  normalForm: "responsibilityBoundary",
};

function projectedSourceIds(view: ProcessView): Set<string> {
  const ids = new Set<string>();
  for (const activity of view.activities) {
    if (activity.kind === "atomic") ids.add(activity.activityId);
    else for (const id of activity.activityIds) ids.add(id);
  }
  return ids;
}

test("existing public exports remain available", () => {
  const exports = Object.keys(api);
  for (const name of [
    "boundaryOf",
    "projectByResponsibilityBoundary",
    "isResponsibilityBoundaryNormalForm",
  ]) {
    assert.equal(exports.includes(name), true, `missing export: ${name}`);
  }

  const typed: ProcessView = {
    view: teamView,
    activities: [],
    flows: [],
  };
  const projected: ProjectedActivity = {
    id: "a",
    kind: "atomic",
    activityId: "a",
    boundary: "sales",
    input: "Inquiry",
    output: "Estimate",
  };
  assert.equal(typed.flows.length, 0);
  assert.equal(projected.kind, "atomic");
});

test("INV-1: projection does not mutate the source model", () => {
  const snapshot = structuredClone(linearModel);
  const before = boundaryOf(linearModel.activities.a!, "team");

  projectByResponsibilityBoundary(linearModel, teamView);

  assert.equal(boundaryOf(linearModel.activities.a!, "team"), before);
  assert.deepEqual(linearModel, snapshot);
});

test("INV-2: core public API exposes no mutation entry points (heuristic proxy via export-name pattern)", () => {
  const mutatorPattern =
    /^(set|update|mutate|assign|apply|patch|commit|delete|remove|write|push|pop|splice)/i;
  const offenders = Object.keys(api).filter((name) => mutatorPattern.test(name));

  assert.deepEqual(offenders, []);
});

test("INV-4: projected source activities are a subset of leaf activity ids", () => {
  const model: ProcessModel = {
    schemaVersion: "responsible.v0",
    activities: {
      parent: { id: "parent", input: "Inquiry", output: "Plan", children: ["a", "b"] },
      a: { id: "a", input: "Inquiry", output: "Estimate", responsibility: { team: "sales" } },
      b: { id: "b", input: "Estimate", output: "Approved", responsibility: { team: "sales" } },
      c: { id: "c", input: "Approved", output: "Plan", responsibility: { team: "eng" } },
    },
    flows: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ],
  };

  const view = projectByResponsibilityBoundary(model, teamView);
  const sources = projectedSourceIds(view);
  const leaves = new Set(leafActivityIds(model));

  assert.equal(leaves.has("parent"), false);
  for (const id of sources) {
    assert.equal(leaves.has(id), true, `projected source ${id} is not a leaf`);
  }
});

test("INV-5: no restoration / inverse projection API is exported (heuristic proxy via export-name pattern)", () => {
  const restorePattern = /restore|inverse|unproject|reverse|deproject|expand/i;
  const offenders = Object.keys(api).filter((name) => restorePattern.test(name));

  assert.deepEqual(offenders, []);
});

test("INV-6: same-boundary run composes into a composite ProjectedActivity", () => {
  const view = projectByResponsibilityBoundary(linearModel, teamView);

  const composite = view.activities.find((activity) => activity.kind === "composite");
  assert.ok(composite, "expected a composite projected activity");
  if (composite.kind !== "composite") return;

  assert.deepEqual([...composite.activityIds], ["a", "b"]);
  assert.equal(composite.input, linearModel.activities.a!.input);
  assert.equal(composite.output, linearModel.activities.b!.output);
  assert.equal(composite.boundary, "sales");
});

test("RBNF: a valid projection has no adjacent same-boundary steps", () => {
  const view = projectByResponsibilityBoundary(linearModel, teamView);

  assert.equal(isResponsibilityBoundaryNormalForm(view), true);
});

test("pure projection core modules import only relative modules (dependency-free core)", () => {
  const coreModules = [
    "model.ts",
    "boundary.ts",
    "hierarchy.ts",
    "normalize.ts",
    "semantic.ts",
    "graph.ts",
    "index.ts",
  ];
  for (const file of coreModules) {
    const url = new URL(`../../src/${file}`, import.meta.url);
    const source = readFileSync(fileURLToPath(url), "utf8");
    const specifiers = [
      ...source.matchAll(/^\s*(?:import|export)\b[^;\n]*?\bfrom\s+["']([^"']+)["']/g),
    ].map((match) => match[1] ?? "");
    for (const specifier of specifiers) {
      assert.equal(
        specifier.startsWith("./") || specifier.startsWith("../"),
        true,
        `${file} imports non-relative dependency "${specifier}"`,
      );
    }
  }
});

test("reference viewer declares react / react-dom / @xyflow/react runtime dependencies", () => {
  const pkgPath = fileURLToPath(new URL("../../package.json", import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  assert.ok(pkg.dependencies, "package.json must declare runtime dependencies for the viewer");
  for (const name of ["react", "react-dom", "@xyflow/react"]) {
    assert.equal(typeof pkg.dependencies?.[name], "string", `missing runtime dependency: ${name}`);
  }
  assert.equal(typeof pkg.devDependencies, "object");
  assert.ok(pkg.devDependencies !== null);
});
