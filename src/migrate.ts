import type { ProcessModel } from "./model.js";

/**
 * Upgrades a `responsible.v0` model to `responsible.v1`.
 *
 * v1 is a strict superset of v0 (docs/responsible-v1.md), so the migration
 * rewrites `schemaVersion` and nothing else. A v1 model is returned unchanged.
 */
export function migrateProcessModelToV1(model: ProcessModel): ProcessModel {
  if (model.schemaVersion === "responsible.v1") return model;
  return { ...model, schemaVersion: "responsible.v1" };
}
