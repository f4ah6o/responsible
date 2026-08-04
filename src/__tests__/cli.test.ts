import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const loader = path.join(root, "tools", "test-register.mjs");
const cli = path.join(root, "src", "cli.ts");
const examplesDir = path.join(root, "examples");

type CliResult = Readonly<{ code: number; stdout: string; stderr: string }>;

function runCli(args: readonly string[], input?: string): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", loader, cli, ...args], { cwd: root });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.stdin.end(input);
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

test("responsible validate emits a stable JSON envelope", async () => {
  const result = await runCli([
    "validate",
    path.join(examplesDir, "order-fulfillment.json"),
    "--format",
    "json",
  ]);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    protocolVersion: "responsible.cli.v1",
    command: "validate",
    ok: true,
    results: [{ source: path.join(examplesDir, "order-fulfillment.json"), ok: true }],
  });
});

test("responsible validate exits 1 and reports a JSON path for an invalid model", async () => {
  const dir = await mkdtemp(path.join(root, ".responsible-cli-"));
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

  const dir = await mkdtemp(path.join(root, ".responsible-cli-"));
  try {
    const file = path.join(dir, "migrated.json");
    await writeFile(file, result.stdout);
    const validated = await runCli(["validate", file]);
    assert.equal(validated.code, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("responsible accepts stdin as an agent-friendly input", async () => {
  const input = await readFile(path.join(examplesDir, "order-fulfillment.json"), "utf8");
  const result = await runCli(["migrate", "-", "--compact"], input);
  assert.equal(result.code, 0);
  assert.equal(JSON.parse(result.stdout).schemaVersion, "responsible.v1");
  assert.equal(result.stdout.includes("\n  "), false);
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

test("responsible project accepts model-defined composite boundaries", async () => {
  const result = await runCli([
    "project",
    path.join(examplesDir, "order-fulfillment.json"),
    "--boundary",
    "company,department",
  ]);
  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.stdout).view.boundary, ["company", "department"]);
});

test("responsible project exits 2 when the boundary expression is empty", async () => {
  const result = await runCli([
    "project",
    path.join(examplesDir, "order-fulfillment.json"),
    "--boundary",
    ",",
  ]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /--boundary must contain at least one key/);
  assert.match(result.stderr, /usage: responsible/);
});

test("responsible analyze emits topology and semantic readiness", async () => {
  const result = await runCli([
    "analyze",
    path.join(examplesDir, "application-approval.v1.json"),
    "--boundary",
    "department",
  ]);
  assert.equal(result.code, 0);
  const analysis = JSON.parse(result.stdout);
  assert.equal(analysis.boundary, "department");
  assert.ok(analysis.summary.activities > 0);
  assert.ok(Array.isArray(analysis.responsibility.handoffs));
  assert.ok(Array.isArray(analysis.automation.gaps));
  assert.equal(typeof analysis.semantics.effects.total, "number");
});

test("responsible capabilities exposes the CLI contract", async () => {
  const result = await runCli(["capabilities", "--compact"]);
  assert.equal(result.code, 0);
  const capabilities = JSON.parse(result.stdout);
  assert.equal(capabilities.protocolVersion, "responsible.cli.v1");
  assert.equal(capabilities.input.stdinSentinel, "-");
  assert.equal(capabilities.boundary.modelDefined, true);
  assert.equal(capabilities.exitCodes.usageError, 2);
});

test("responsible with no subcommand shows usage and exits 2", async () => {
  const result = await runCli([]);
  assert.equal(result.code, 2);
  assert.match(result.stdout, /usage: responsible/);
});

test("responsible rejects invalid CLI options with exit 2", async () => {
  const result = await runCli(["validate", "--format", "yaml", "model.json"]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /--format must be text or json/);
});

test("responsible --help shows usage and exits 0", async () => {
  const result = await runCli(["--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /usage: responsible/);
});
