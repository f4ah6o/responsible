#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { HIERARCHICAL_BOUNDARY_ORDER } from "./hierarchy.js";
import { ensureRootActivity, parseProcessModelJson, type ValidationResult } from "./validate.js";
import { migrateProcessModelToV1 } from "./migrate.js";
import { projectDagByResponsibilityBoundary } from "./quotient.js";

const USAGE = `usage: responsible <command> [options]

Commands:
  validate <file...>              Validate one or more model JSON files.
  migrate <file>                  Migrate a responsible.v0 model to v1 and print it to stdout.
  project <file> --boundary <b>   Project a model onto a responsibility boundary and print the ProcessView.

Boundaries: ${HIERARCHICAL_BOUNDARY_ORDER.join(" | ")}

Options:
  -h, --help                      Show this help message.
`;

async function readAndValidate(file: string): Promise<ValidationResult> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          path: "$",
          message: `ファイルを読み込めません: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
  return parseProcessModelJson(text);
}

function reportIssues(file: string, result: Extract<ValidationResult, { ok: false }>): void {
  for (const issue of result.issues) {
    process.stderr.write(`${file}: ${issue.path}: ${issue.message}\n`);
  }
}

async function runValidate(files: readonly string[]): Promise<number> {
  if (files.length === 0) {
    process.stderr.write(`validate: at least one file is required\n\n${USAGE}`);
    return 1;
  }

  let allOk = true;
  for (const file of files) {
    const result = await readAndValidate(file);
    if (result.ok) {
      process.stderr.write(`ok ${file}\n`);
    } else {
      allOk = false;
      reportIssues(file, result);
    }
  }
  return allOk ? 0 : 1;
}

async function runMigrate(files: readonly string[]): Promise<number> {
  if (files.length !== 1) {
    process.stderr.write(`migrate: exactly one file is required\n\n${USAGE}`);
    return 1;
  }

  const [file] = files;
  const result = await readAndValidate(file!);
  if (!result.ok) {
    reportIssues(file!, result);
    return 1;
  }

  const migrated = migrateProcessModelToV1(result.model);
  process.stdout.write(`${JSON.stringify(migrated, null, 2)}\n`);
  return 0;
}

async function runProject(files: readonly string[], boundary: string | undefined): Promise<number> {
  if (files.length !== 1) {
    process.stderr.write(`project: exactly one file is required\n\n${USAGE}`);
    return 1;
  }
  if (
    boundary === undefined ||
    !(HIERARCHICAL_BOUNDARY_ORDER as readonly string[]).includes(boundary)
  ) {
    process.stderr.write(
      `project: --boundary must be one of ${HIERARCHICAL_BOUNDARY_ORDER.join(" | ")}\n\n${USAGE}`,
    );
    return 1;
  }

  const [file] = files;
  const result = await readAndValidate(file!);
  if (!result.ok) {
    reportIssues(file!, result);
    return 1;
  }

  const { model: rooted } = ensureRootActivity(result.model);
  const migrated = migrateProcessModelToV1(rooted);

  try {
    const view = projectDagByResponsibilityBoundary(migrated, {
      id: "cli",
      layout: "lane",
      normalForm: "responsibilityBoundary",
      boundary,
    });
    process.stdout.write(`${JSON.stringify(view, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`project: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

export async function main(argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv as string[],
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      boundary: { type: "string" },
    },
  });

  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  const [command, ...rest] = positionals;
  switch (command) {
    case "validate":
      return runValidate(rest);
    case "migrate":
      return runMigrate(rest);
    case "project":
      return runProject(rest, values.boundary);
    case undefined:
      process.stdout.write(USAGE);
      return 1;
    default:
      process.stderr.write(`unknown command: ${command}\n\n${USAGE}`);
      return 1;
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
    process.exitCode = 1;
  });
