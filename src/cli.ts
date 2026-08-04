#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { analyzeProcessModel } from "./analyze.js";
import { HIERARCHICAL_BOUNDARY_ORDER } from "./hierarchy.js";
import { migrateProcessModelToV1 } from "./migrate.js";
import type { BoundaryExpr } from "./model.js";
import { projectDagByResponsibilityBoundary } from "./quotient.js";
import { leafActivityIds } from "./semantic.js";
import { ensureRootActivity, parseProcessModelJson, type ValidationResult } from "./validate.js";

const EXIT_SUCCESS = 0;
const EXIT_MODEL_ERROR = 1;
const EXIT_USAGE_ERROR = 2;

type OutputFormat = "text" | "json";

type CliOptions = Readonly<{
  boundary?: string;
  compact: boolean;
  format: OutputFormat;
  help: boolean;
  quiet: boolean;
}>;

const USAGE = `usage: responsible <command> [options]

Commands:
  validate <file...>                 Validate one or more model JSON files.
  migrate <file>                     Migrate a responsible.v0 model to v1.
  project <file> --boundary <expr>   Project a model onto a responsibility boundary.
  analyze <file> [--boundary <expr>] Analyze topology, contracts, effects, handoffs, and automation signals.
  capabilities                       Print the stable machine-readable CLI contract.

Input:
  Use - as a file name to read UTF-8 model JSON from stdin.

Boundary expression:
  A responsibility key such as department, or comma-separated keys such as
  company,department. Keys are model-defined; common keys are:
  ${HIERARCHICAL_BOUNDARY_ORDER.join(" | ")}

Options:
  --boundary <expr>                  Boundary key or comma-separated key path.
  --format <text|json>               Validation output format (default: text).
  --compact                          Emit compact JSON instead of pretty JSON.
  -q, --quiet                        Suppress successful text validation messages.
  -h, --help                         Show this help message.

Exit codes:
  0  Success.
  1  Invalid model, failed projection, or failed analysis operation.
  2  Invalid command-line usage.
`;

const CAPABILITIES = {
  protocolVersion: "responsible.cli.v1",
  schemas: ["responsible.v0", "responsible.v1"],
  input: {
    encoding: "utf-8",
    mediaType: "application/json",
    stdinSentinel: "-",
  },
  boundary: {
    syntax: "key or comma-separated key path",
    modelDefined: true,
    commonKeys: HIERARCHICAL_BOUNDARY_ORDER,
  },
  commands: {
    validate: {
      cardinality: "one-or-more",
      output: ["text", "json"],
      description: "Structural, referential, and decomposition validation.",
    },
    migrate: {
      cardinality: "exactly-one",
      output: ["json"],
      description: "Lossless responsible.v0 to responsible.v1 migration.",
    },
    project: {
      cardinality: "exactly-one",
      requiredOptions: ["boundary"],
      output: ["json"],
      description: "Responsibility-boundary graph quotient projection.",
    },
    analyze: {
      cardinality: "exactly-one",
      optionalOptions: ["boundary"],
      defaultBoundary: "department",
      output: ["json"],
      description:
        "Semantic analysis spanning topology, responsibility, contracts, effects, handoffs, and automation signals.",
    },
    capabilities: {
      cardinality: "zero",
      output: ["json"],
      description: "This machine-readable command contract.",
    },
  },
  exitCodes: {
    success: EXIT_SUCCESS,
    modelOrOperationError: EXIT_MODEL_ERROR,
    usageError: EXIT_USAGE_ERROR,
  },
} as const;

async function readStdin(): Promise<string> {
  process.stdin.setEncoding("utf8");
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

async function readAndValidate(source: string): Promise<ValidationResult> {
  let text: string;
  try {
    text = source === "-" ? await readStdin() : await readFile(source, "utf8");
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          path: "$",
          message: `cannot read input: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
  return parseProcessModelJson(text);
}

function reportIssues(source: string, result: Extract<ValidationResult, { ok: false }>): void {
  for (const issue of result.issues) {
    process.stderr.write(`${source}: ${issue.path}: ${issue.message}\n`);
  }
}

function writeJson(value: unknown, compact: boolean): void {
  process.stdout.write(`${JSON.stringify(value, null, compact ? undefined : 2)}\n`);
}

function usageError(command: string, message: string): number {
  process.stderr.write(`${command}: ${message}\n\n${USAGE}`);
  return EXIT_USAGE_ERROR;
}

function requireExactlyOne(command: string, files: readonly string[]): string | number {
  if (files.length !== 1) return usageError(command, "exactly one file is required");
  return files[0]!;
}

function validateStdinCardinality(command: string, files: readonly string[]): number | undefined {
  if (files.filter((file) => file === "-").length > 1) {
    return usageError(command, "stdin sentinel '-' may appear at most once");
  }
  return undefined;
}

async function runValidate(files: readonly string[], options: CliOptions): Promise<number> {
  if (files.length === 0) return usageError("validate", "at least one file is required");
  const stdinError = validateStdinCardinality("validate", files);
  if (stdinError !== undefined) return stdinError;

  const results: Array<
    | Readonly<{ source: string; ok: true }>
    | Readonly<{
        source: string;
        ok: false;
        issues: Extract<ValidationResult, { ok: false }>["issues"];
      }>
  > = [];

  for (const source of files) {
    const result = await readAndValidate(source);
    if (result.ok) {
      results.push({ source, ok: true });
      if (options.format === "text" && !options.quiet) process.stderr.write(`ok ${source}\n`);
    } else {
      results.push({ source, ok: false, issues: result.issues });
      if (options.format === "text") reportIssues(source, result);
    }
  }

  const ok = results.every((result) => result.ok);
  if (options.format === "json") {
    writeJson(
      { protocolVersion: "responsible.cli.v1", command: "validate", ok, results },
      options.compact,
    );
  }
  return ok ? EXIT_SUCCESS : EXIT_MODEL_ERROR;
}

async function runMigrate(files: readonly string[], options: CliOptions): Promise<number> {
  const source = requireExactlyOne("migrate", files);
  if (typeof source === "number") return source;
  const result = await readAndValidate(source);
  if (!result.ok) {
    reportIssues(source, result);
    return EXIT_MODEL_ERROR;
  }

  writeJson(migrateProcessModelToV1(result.model), options.compact);
  return EXIT_SUCCESS;
}

async function runProject(files: readonly string[], options: CliOptions): Promise<number> {
  const source = requireExactlyOne("project", files);
  if (typeof source === "number") return source;
  const boundary = parseBoundaryExpr(options.boundary);
  if (!boundary) return usageError("project", "--boundary must contain at least one key");

  const result = await readAndValidate(source);
  if (!result.ok) {
    reportIssues(source, result);
    return EXIT_MODEL_ERROR;
  }

  const { model: rooted } = ensureRootActivity(result.model);
  const leafIds = leafActivityIds(rooted);
  const leafSet = new Set(leafIds);
  const scoped = {
    schemaVersion: rooted.schemaVersion,
    activities: Object.fromEntries(leafIds.map((id) => [id, rooted.activities[id]!])),
    flows: rooted.flows.filter((flow) => leafSet.has(flow.from) && leafSet.has(flow.to)),
  } as const;
  const migrated = migrateProcessModelToV1(rooted);

  try {
    const view = projectDagByResponsibilityBoundary(
      { ...migrated, activities: scoped.activities, flows: scoped.flows },
      {
        id: "cli",
        layout: "lane",
        normalForm: "responsibilityBoundary",
        boundary,
      },
    );
    writeJson(view, options.compact);
    return EXIT_SUCCESS;
  } catch (error) {
    process.stderr.write(`project: ${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_MODEL_ERROR;
  }
}

async function runAnalyze(files: readonly string[], options: CliOptions): Promise<number> {
  const source = requireExactlyOne("analyze", files);
  if (typeof source === "number") return source;
  const boundary =
    options.boundary === undefined ? "department" : parseBoundaryExpr(options.boundary);
  if (!boundary) return usageError("analyze", "--boundary must contain at least one key");

  const result = await readAndValidate(source);
  if (!result.ok) {
    reportIssues(source, result);
    return EXIT_MODEL_ERROR;
  }

  writeJson(analyzeProcessModel(result.model, boundary), options.compact);
  return EXIT_SUCCESS;
}

function parseBoundaryExpr(value: string | undefined): BoundaryExpr | undefined {
  if (value === undefined) return undefined;
  const keys = value
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
  if (keys.length === 0) return undefined;
  return keys.length === 1 ? keys[0]! : keys;
}

function parseCli(argv: readonly string[]):
  | Readonly<{
      ok: true;
      command: string | undefined;
      files: readonly string[];
      options: CliOptions;
    }>
  | Readonly<{ ok: false; message: string }> {
  try {
    const { values, positionals } = parseArgs({
      args: argv as string[],
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: "boolean", short: "h" },
        boundary: { type: "string" },
        compact: { type: "boolean" },
        format: { type: "string", default: "text" },
        quiet: { type: "boolean", short: "q" },
      },
    });

    if (values.format !== "text" && values.format !== "json") {
      return { ok: false, message: "--format must be text or json" };
    }

    const [command, ...files] = positionals;
    return {
      ok: true,
      command,
      files,
      options: {
        ...(values.boundary === undefined ? {} : { boundary: values.boundary }),
        compact: values.compact ?? false,
        format: values.format,
        help: values.help ?? false,
        quiet: values.quiet ?? false,
      },
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function main(argv: readonly string[]): Promise<number> {
  const parsed = parseCli(argv);
  if (!parsed.ok) return usageError("responsible", parsed.message);
  const { command, files, options } = parsed;

  if (options.help) {
    process.stdout.write(USAGE);
    return EXIT_SUCCESS;
  }

  switch (command) {
    case "validate":
      return runValidate(files, options);
    case "migrate":
      return runMigrate(files, options);
    case "project":
      return runProject(files, options);
    case "analyze":
      return runAnalyze(files, options);
    case "capabilities":
      if (files.length > 0) return usageError("capabilities", "no files are accepted");
      writeJson(CAPABILITIES, options.compact);
      return EXIT_SUCCESS;
    case undefined:
      process.stdout.write(USAGE);
      return EXIT_USAGE_ERROR;
    default:
      return usageError("responsible", `unknown command: ${command}`);
  }
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = EXIT_MODEL_ERROR;
  });
