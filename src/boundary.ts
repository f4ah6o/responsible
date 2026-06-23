import type { ActivityDef, BoundaryExpr, BoundaryValue } from "./model.js";

export function boundaryOf(activity: ActivityDef, boundary: BoundaryExpr): string {
  if (Array.isArray(boundary)) {
    return boundary.map((key) => `${key}:${formatBoundaryValue(resolveBoundaryValue(activity, key))}`).join("|");
  }

  return formatBoundaryValue(resolveBoundaryValue(activity, boundary));
}

export function resolveBoundaryValue(activity: ActivityDef, key: string): BoundaryValue | undefined {
  const responsibility = activity.responsibility;
  if (!responsibility) return undefined;

  const parts = key.split(".");
  let value: unknown = responsibility;

  for (const part of parts) {
    if (!isRecord(value)) return undefined;
    value = value[part];
  }

  return isBoundaryValue(value) ? value : undefined;
}

export function formatBoundaryValue(value: BoundaryValue | undefined): string {
  if (value === undefined) return "<unassigned>";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(formatBoundaryValue).join(",")}]`;

  const entries = Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nested]) => `${key}:${formatBoundaryValue(nested)}`);

  return `{${entries.join(",")}}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundaryValue(value: unknown): value is BoundaryValue {
  if (value === undefined) return true;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(isBoundaryValue);
  if (isRecord(value)) return Object.values(value).every(isBoundaryValue);
  return false;
}
