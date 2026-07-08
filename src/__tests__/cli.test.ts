import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const loader = path.join(root, "tools", "test-register.mjs");
const cli = path.join(root, "src", "cli.ts");
const examplesDir = path.join(root, "examples");

type CliResult = Readonly<{ code: number; stdout: string; stderr: string }>;

function runCli(args: readonly string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ["--import", loader, cli, ...args],
      { cwd: root },
      (error, stdout, stderr) => {
        const code = error && "code" in error && typeof error.code === "number" ? error.code : 0;
        resolve({ code, stdout, stderr });
      },
    );
  });
}

test("responsible validate exits 0 for valid models", async () => {
  const result = await runCli([
    "validate",
    path.join(examplesDir, "order-fulfillment.json"),
    path.join(examplesDir, "application-approval.v1.json"),
  ]);
  assert.equal(result.code, 0);
  assert.match(result.stderr, /ok .*order-fulfillment\.json/);
  assert.match(result.stderr, /ok .*application-approval\.v1\.json/);
});

test("responsible validate exits 1 and reports a JSON path for an invalid model", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "responsible-cli-"));
  try {
    const file = path.join(dir, "broken.json");
    await writeFile(
      file,
      JSON.stringify({
        schemaVersion: "responsible.v0",
        activities: { a: { id: "a", output: "Out" } },
        flows: [],
      }),
    );

    const result = await runCli(["validate", file]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /\$\.activities\.a\.input/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("responsible validate exits 1 for a missing file", async () => {
  const result = await runCli(["validate", path.join(examplesDir, "does-not-exist.json")]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /does-not-exist\.json/);
});

test("responsible migrate prints a v1 model that itself validates", async () => {
  const result = await runCli(["migrate", path.join(examplesDir, "order-fulfillment.json")]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /"schemaVersion":\s*"responsible\.v1"/);

  const dir = await mkdtemp(path.join(tmpdir(), "responsible-cli-"));
  try {
    const file = path.join(dir, "migrated.json");
    await writeFile(file, result.stdout);
    const validated = await runCli(["validate", file]);
    assert.equal(validated.code, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("responsible project prints a ProcessView for a valid boundary", async () => {
  const result = await runCli([
    "project",
    path.join(examplesDir, "order-fulfillment.json"),
    "--boundary",
    "department",
  ]);
  assert.equal(result.code, 0);
  const view = JSON.parse(result.stdout);
  assert.equal(view.view.boundary, "department");
  assert.ok(Array.isArray(view.activities));
  assert.ok(Array.isArray(view.flows));
});

test("responsible project exits 1 and shows usage for an invalid boundary", async () => {
  const result = await runCli([
    "project",
    path.join(examplesDir, "order-fulfillment.json"),
    "--boundary",
    "planet",
  ]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /--boundary must be one of/);
  assert.match(result.stderr, /usage: responsible/);
});

test("responsible with no subcommand shows usage and exits 1", async () => {
  const result = await runCli([]);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /usage: responsible/);
});

test("responsible --help shows usage and exits 0", async () => {
  const result = await runCli(["--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /usage: responsible/);
});
