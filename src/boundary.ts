import type { ActivityDef, BoundaryExpr, BoundaryValue, Responsibility } from "./model.js";

const CODEC_PREFIX = "\u0001";

export type DecodedBoundaryPart = Readonly<{
  key?: string;
  value: BoundaryValue | undefined;
}>;

export function boundaryOf(activity: ActivityDef, boundary: BoundaryExpr): string {
  return boundaryOfResponsibility(activity.responsibility, boundary);
}

/**
 * Resolves a bare `Responsibility` record to a boundary id with the same rule
 * as Activities. Used for boundary-expression-independent references such as
 * a directed effect's declared `target` (docs/responsible-v1.md).
 */
export function boundaryOfResponsibility(
  responsibility: Responsibility | undefined,
  boundary: BoundaryExpr,
): string {
  if (typeof boundary !== "string") {
    return boundaryIdForPath(
      boundary.map((key) => ({
        key,
        value: resolveResponsibilityValue(responsibility, key),
      })),
    );
  }

  return formatBoundaryValue(resolveResponsibilityValue(responsibility, boundary));
}

export function resolveBoundaryValue(
  activity: ActivityDef,
  key: string,
): BoundaryValue | undefined {
  return resolveResponsibilityValue(activity.responsibility, key);
}

function resolveResponsibilityValue(
  responsibility: Responsibility | undefined,
  key: string,
): BoundaryValue | undefined {
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
  if (value === undefined) return `${CODEC_PREFIX}u`;
  if (typeof value === "string") {
    // Plain strings stay readable and backwards-compatible. Strings that
    // contain legacy composite separators use the typed form so decoding is
    // unambiguous even without knowing the number of boundary axes.
    if (value.includes(":") || value.includes("|")) {
      return `${CODEC_PREFIX}s${JSON.stringify(value)}`;
    }
    return value.startsWith(CODEC_PREFIX) ? `${CODEC_PREFIX}${value}` : value;
  }
  if (typeof value === "number") {
    return `${CODEC_PREFIX}n${Object.is(value, -0) ? "-0" : String(value)}`;
  }
  if (typeof value === "boolean") return `${CODEC_PREFIX}b${value ? "1" : "0"}`;
  if (Array.isArray(value)) {
    return `${CODEC_PREFIX}a${JSON.stringify(value.map((entry) => formatBoundaryValue(entry)))}`;
  }

  const entries = Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nested]) => [key, formatBoundaryValue(nested)] as const);
  return `${CODEC_PREFIX}o${JSON.stringify(entries)}`;
}

/**
 * Converts a multi-axis boundary into its identity representation. Legacy
 * `key:value|key:value` strings are retained only when every component is a
 * plain delimiter-free string. All other values use a typed JSON codec, so
 * identity never depends on reparsing display punctuation.
 */
export function boundaryIdForPath(parts: readonly DecodedBoundaryPart[]): string {
  const canUseLegacy = parts.every(
    ({ key, value }) =>
      typeof key === "string" &&
      !key.includes(":") &&
      !key.includes("|") &&
      typeof value === "string" &&
      !value.includes(":") &&
      !value.includes("|") &&
      !value.startsWith(CODEC_PREFIX),
  );

  if (canUseLegacy) {
    return parts.map(({ key, value }) => `${key}:${value}`).join("|");
  }

  return `${CODEC_PREFIX}p${JSON.stringify(
    parts.map(({ key, value }) => [key ?? null, formatBoundaryValue(value)]),
  )}`;
}

/** Decodes either a legacy or codec boundary identity for display/layout. */
export function decodeBoundaryId(boundaryId: string): readonly DecodedBoundaryPart[] {
  if (boundaryId.startsWith(`${CODEC_PREFIX}p`)) {
    try {
      const raw: unknown = JSON.parse(boundaryId.slice(2));
      if (!Array.isArray(raw)) return [{ value: boundaryId }];
      return raw.flatMap((entry): DecodedBoundaryPart[] => {
        if (!Array.isArray(entry) || entry.length !== 2) return [];
        const [key, encoded] = entry;
        if (key !== null && typeof key !== "string") return [];
        if (typeof encoded !== "string") return [];
        return [{ ...(key === null ? {} : { key }), value: decodeBoundaryValue(encoded) }];
      });
    } catch {
      return [{ value: boundaryId }];
    }
  }

  if (boundaryId.startsWith(CODEC_PREFIX)) {
    return [{ value: decodeBoundaryValue(boundaryId) }];
  }

  if (boundaryId.includes("|")) {
    return boundaryId.split("|").map((part) => {
      const index = part.indexOf(":");
      return index < 0
        ? { value: part }
        : { key: part.slice(0, index), value: part.slice(index + 1) };
    });
  }

  return [{ value: decodeBoundaryValue(boundaryId) }];
}

/** Human-facing label for a boundary value; never use this for identity. */
export function displayBoundaryValue(value: BoundaryValue | undefined): string {
  if (value === undefined) return "<unassigned>";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(displayBoundaryValue).join(",")}]`;

  const entries = Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nested]) => `${key}:${displayBoundaryValue(nested)}`);
  return `{${entries.join(",")}}`;
}

function decodeBoundaryValue(encoded: string): BoundaryValue | undefined {
  if (!encoded.startsWith(CODEC_PREFIX)) return encoded;
  if (encoded.startsWith(`${CODEC_PREFIX}${CODEC_PREFIX}`)) return encoded.slice(1);

  const tag = encoded[1];
  const payload = encoded.slice(2);
  if (tag === "u") return undefined;
  if (tag === "s") {
    try {
      const raw: unknown = JSON.parse(payload);
      return typeof raw === "string" ? raw : encoded;
    } catch {
      return encoded;
    }
  }
  if (tag === "b") return payload === "1";
  if (tag === "n") return Number(payload);
  if (tag === "a") {
    try {
      const raw: unknown = JSON.parse(payload);
      if (!Array.isArray(raw)) return encoded;
      const decoded = raw.map((entry) => decodeBoundaryValue(String(entry)));
      return decoded.every((entry): entry is BoundaryValue => entry !== undefined)
        ? decoded
        : encoded;
    } catch {
      return encoded;
    }
  }
  if (tag === "o") {
    try {
      const raw: unknown = JSON.parse(payload);
      if (!Array.isArray(raw)) return encoded;
      const result: Record<string, BoundaryValue> = {};
      for (const entry of raw) {
        if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string") {
          return encoded;
        }
        const decoded = decodeBoundaryValue(String(entry[1]));
        if (decoded === undefined) return encoded;
        result[entry[0]] = decoded;
      }
      return result;
    } catch {
      return encoded;
    }
  }
  return encoded;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundaryValue(value: unknown): value is BoundaryValue {
  if (value === undefined) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isBoundaryValue);
  if (isRecord(value)) return Object.values(value).every(isBoundaryValue);
  return false;
}
