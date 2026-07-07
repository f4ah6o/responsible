import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import { validateProcessModel } from "../index.js";
import { sampleProcesses } from "../sample.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const schemasDir = path.join(root, "schemas");
const publicSchemasDir = path.join(root, "public", "schemas");
const examplesDir = path.join(root, "examples");

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const v0Schema = readJson(path.join(schemasDir, "responsible.v0.schema.json"));
const v1Schema = readJson(path.join(schemasDir, "responsible.v1.schema.json"));
const validateV0 = ajv.compile(v0Schema as object);
const validateV1 = ajv.compile(v1Schema as object);

function schemaFor(version: string): typeof validateV0 {
  if (version === "responsible.v0") return validateV0;
  if (version === "responsible.v1") return validateV1;
  throw new Error(`unknown schemaVersion: ${version}`);
}

test("schemas/*.schema.json is mirrored byte-for-byte in public/schemas/", () => {
  for (const entry of readdirSync(schemasDir)) {
    if (!entry.endsWith(".schema.json")) continue;
    const canonical = readFileSync(path.join(schemasDir, entry), "utf8");
    const published = readFileSync(path.join(publicSchemasDir, entry), "utf8");
    assert.equal(
      published,
      canonical,
      `public/schemas/${entry} is out of sync; run \`pnpm run sync-schemas\``,
    );
  }
});

test("responsible.v0 / v1 schemas are themselves valid JSON Schema (draft 2020-12)", () => {
  assert.equal(ajv.validateSchema(v0Schema as object), true);
  assert.equal(ajv.validateSchema(v1Schema as object), true);
});

for (const sample of sampleProcesses) {
  test(`schema: bundled sample "${sample.id}" conforms to its ${sample.model.schemaVersion} schema`, () => {
    const validate = schemaFor(sample.model.schemaVersion);
    const ok = validate(sample.model);
    assert.equal(ok, true, JSON.stringify(validate.errors, null, 2));
  });
}

for (const file of readdirSync(examplesDir)) {
  if (!file.endsWith(".json")) continue;
  test(`schema: examples/${file} conforms to its declared schemaVersion's schema`, () => {
    const model = readJson(path.join(examplesDir, file)) as { schemaVersion: string };
    const validate = schemaFor(model.schemaVersion);
    const ok = validate(model);
    assert.equal(ok, true, JSON.stringify(validate.errors, null, 2));
  });

  test(`core: examples/${file} is accepted by validateProcessModel`, () => {
    const model = readJson(path.join(examplesDir, file));
    const result = validateProcessModel(model);
    assert.equal(result.ok, true);
  });
}

test("a model carrying $schema is valid under both the schema and validateProcessModel", () => {
  const model = {
    $schema: "https://f4ah6o.github.io/responsible/schemas/responsible.v1.schema.json",
    schemaVersion: "responsible.v1",
    activities: {
      a: { id: "a", input: "X", output: "Y" },
    },
    flows: [],
  };
  assert.equal(validateV1(model), true, JSON.stringify(validateV1.errors, null, 2));
  assert.equal(validateProcessModel(model).ok, true);
});

test("a missing required key is rejected by both the schema and validateProcessModel", () => {
  const model = {
    schemaVersion: "responsible.v0",
    activities: {
      a: { id: "a", input: "X", output: "Y" },
    },
    // flows is missing entirely
  };
  assert.equal(validateV0(model), false);
  assert.equal(validateProcessModel(model).ok, false);
});

test("an invalid schemaVersion is rejected by both the schema and validateProcessModel", () => {
  const model = {
    schemaVersion: "responsible.v2",
    activities: {
      a: { id: "a", input: "X", output: "Y" },
    },
    flows: [],
  };
  assert.equal(validateV0(model), false);
  assert.equal(validateV1(model), false);
  assert.equal(validateProcessModel(model).ok, false);
});

test("a non-array flows field is rejected by both the schema and validateProcessModel", () => {
  const model = {
    schemaVersion: "responsible.v0",
    activities: {
      a: { id: "a", input: "X", output: "Y" },
    },
    flows: { from: "a", to: "a" },
  };
  assert.equal(validateV0(model), false);
  assert.equal(validateProcessModel(model).ok, false);
});

test("responsible.v1 fields (requires/ensures/effects) on an Activity are rejected by the v0 schema", () => {
  const model = {
    schemaVersion: "responsible.v0",
    activities: {
      a: { id: "a", input: "X", output: "Y", requires: ["X.status = ready"] },
    },
    flows: [],
  };
  assert.equal(validateV0(model), false);
  assert.equal(validateProcessModel(model).ok, false);
});

test("an unknown key in an Activity is rejected by the schema (typo protection)", () => {
  const model = {
    schemaVersion: "responsible.v0",
    activities: {
      a: { id: "a", input: "X", output: "Y", resposibility: { role: "typo" } },
    },
    flows: [],
  };
  assert.equal(validateV0(model), false);
});

test("a malformed v1 effect delivery is rejected by both the schema and validateProcessModel", () => {
  const model = {
    schemaVersion: "responsible.v1",
    activities: {
      a: {
        id: "a",
        input: "X",
        output: "Y",
        effects: [{ payload: { kind: "command", schema: "S" }, delivery: { mode: "directed" } }],
      },
    },
    flows: [],
  };
  assert.equal(validateV1(model), false);
  assert.equal(validateProcessModel(model).ok, false);
});
