import type {
  ActivityDef,
  ActivityStatus,
  BoundaryValue,
  EffectPayloadKind,
  Id,
  ProcessModel,
  Responsibility,
  SchemaVersion,
} from "./model.js";

export type ValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type ValidationResult =
  | Readonly<{ ok: true; model: ProcessModel }>
  | Readonly<{ ok: false; issues: readonly ValidationIssue[] }>;

const ACTIVITY_STATUSES: readonly ActivityStatus[] = [
  "discovered",
  "defined",
  "validated",
  "automatable",
];

const SCHEMA_VERSIONS: readonly SchemaVersion[] = ["responsible.v0", "responsible.v1"];

const V1_ACTIVITY_FIELDS = ["requires", "ensures", "effects"] as const;

const EFFECT_PAYLOAD_KINDS: readonly EffectPayloadKind[] = ["domain-fact", "command", "data"];

const EFFECT_DELIVERY_MODES = ["directed", "broadcast", "observable"] as const;

/**
 * Validates an untrusted value (e.g. parsed JSON) as a `ProcessModel`.
 *
 * Checks structural shape, referential integrity (flows / children point to
 * known activities), and the absence of decomposition cycles. Returns either
 * the value typed as `ProcessModel` or a list of human-readable issues with
 * JSON-path-like locations.
 */
export function validateProcessModel(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isRecord(value)) {
    return invalid([{ path: "$", message: "ProcessModel はオブジェクトである必要があります" }]);
  }

  if (!SCHEMA_VERSIONS.includes(value["schemaVersion"] as SchemaVersion)) {
    issues.push({
      path: "$.schemaVersion",
      message: `schemaVersion は ${SCHEMA_VERSIONS.map((v) => `"${v}"`).join(" / ")} のいずれかである必要があります（受け取った値: ${JSON.stringify(value["schemaVersion"])}）`,
    });
  }
  const isV1 = value["schemaVersion"] === "responsible.v1";

  const activities = value["activities"];
  const activityIds = new Set<Id>();

  if (!isRecord(activities)) {
    issues.push({
      path: "$.activities",
      message: "activities は Activity ID をキーとするオブジェクトである必要があります",
    });
  } else {
    if (Object.keys(activities).length === 0) {
      issues.push({
        path: "$.activities",
        message: "activities には少なくとも 1 件の Activity が必要です",
      });
    }
    for (const [id, def] of Object.entries(activities)) {
      activityIds.add(id);
      validateActivityDef(id, def, isV1, issues);
    }
    // Referential checks need the full id set, so they run in a second pass.
    for (const [id, def] of Object.entries(activities)) {
      if (!isRecord(def)) continue;
      const children = def["children"];
      if (!Array.isArray(children)) continue;
      for (const [index, childId] of children.entries()) {
        if (typeof childId !== "string") continue;
        if (!activityIds.has(childId)) {
          issues.push({
            path: `$.activities.${id}.children[${index}]`,
            message: `children が未定義の Activity "${childId}" を参照しています`,
          });
        }
        if (childId === id) {
          issues.push({
            path: `$.activities.${id}.children[${index}]`,
            message: "Activity は自分自身を children に含められません",
          });
        }
      }
    }
    validateNoDecompositionCycle(activities, issues);
  }

  const flows = value["flows"];
  if (!Array.isArray(flows)) {
    issues.push({ path: "$.flows", message: "flows は配列である必要があります" });
  } else {
    for (const [index, flow] of flows.entries()) {
      validateFlowDef(index, flow, activityIds, issues);
    }
  }

  const views = value["views"];
  if (views !== undefined) {
    if (!Array.isArray(views)) {
      issues.push({ path: "$.views", message: "views は配列である必要があります" });
    } else {
      for (const [index, view] of views.entries()) {
        validateViewDef(index, view, issues);
      }
    }
  }

  if (issues.length > 0) return invalid(issues);
  return { ok: true, model: value as unknown as ProcessModel };
}

/**
 * Parses a JSON string and validates it as a `ProcessModel`.
 */
export function parseProcessModelJson(text: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return invalid([
      {
        path: "$",
        message: `JSON として解釈できません: ${error instanceof Error ? error.message : String(error)}`,
      },
    ]);
  }
  return validateProcessModel(parsed);
}

/**
 * Returns the unique root Activity ID: the only Activity that no other
 * Activity lists in `children`. Returns `undefined` when the model has no
 * activities or when multiple top-level activities exist.
 */
export function inferRootActivityId(model: ProcessModel): Id | undefined {
  const childIds = new Set<Id>();
  for (const activity of Object.values(model.activities)) {
    for (const childId of activity.children ?? []) childIds.add(childId);
  }

  const roots = Object.keys(model.activities).filter((id) => !childIds.has(id));
  return roots.length === 1 ? roots[0] : undefined;
}

export type RootedProcessModel = Readonly<{
  model: ProcessModel;
  rootActivityId: Id;
}>;

/**
 * Guarantees the model has a single root Activity for scope-based viewing.
 *
 * If the model already has a unique root, it is returned unchanged. Otherwise
 * a synthetic root Activity is added whose `children` are the current
 * top-level activities, so flat models (activities + flows, no hierarchy) can
 * be displayed without manual wrapping.
 */
export function ensureRootActivity(
  model: ProcessModel,
  options?: Readonly<{ id?: Id; name?: string }>,
): RootedProcessModel {
  const existing = inferRootActivityId(model);
  if (existing !== undefined) return { model, rootActivityId: existing };

  let rootId = options?.id ?? "__process__";
  while (model.activities[rootId]) rootId = `_${rootId}`;

  const childIds = new Set<Id>();
  for (const activity of Object.values(model.activities)) {
    for (const childId of activity.children ?? []) childIds.add(childId);
  }
  const topLevel = Object.keys(model.activities).filter((id) => !childIds.has(id));

  const incoming = new Set(model.flows.map((flow) => flow.to));
  const outgoing = new Set(model.flows.map((flow) => flow.from));
  const starts = topLevel.filter((id) => !incoming.has(id));
  const ends = topLevel.filter((id) => !outgoing.has(id));
  const startActivity = starts.length === 1 ? model.activities[starts[0]!] : undefined;
  const endActivity = ends.length === 1 ? model.activities[ends[0]!] : undefined;

  const root: ActivityDef = {
    id: rootId,
    name: options?.name ?? "プロセス全体",
    input: startActivity?.input ?? "<view boundary>",
    output: endActivity?.output ?? "<view boundary>",
    children: topLevel,
  };

  return {
    model: {
      ...model,
      activities: { ...model.activities, [rootId]: root },
    },
    rootActivityId: rootId,
  };
}

function validateActivityDef(id: Id, def: unknown, isV1: boolean, issues: ValidationIssue[]): void {
  const path = `$.activities.${id}`;

  if (!isRecord(def)) {
    issues.push({ path, message: "Activity 定義はオブジェクトである必要があります" });
    return;
  }

  if (def["id"] !== id) {
    issues.push({
      path: `${path}.id`,
      message: `id はキー "${id}" と一致する必要があります（受け取った値: ${JSON.stringify(def["id"])}）`,
    });
  }

  for (const field of ["input", "output"] as const) {
    const fieldValue = def[field];
    if (typeof fieldValue !== "string" || fieldValue.length === 0) {
      issues.push({
        path: `${path}.${field}`,
        message: `${field} は空でない文字列（型参照）である必要があります`,
      });
    }
  }

  if (def["name"] !== undefined && typeof def["name"] !== "string") {
    issues.push({ path: `${path}.name`, message: "name は文字列である必要があります" });
  }

  const status = def["status"];
  if (status !== undefined && !ACTIVITY_STATUSES.includes(status as ActivityStatus)) {
    issues.push({
      path: `${path}.status`,
      message: `status は ${ACTIVITY_STATUSES.join(" / ")} のいずれかである必要があります`,
    });
  }

  const children = def["children"];
  if (children !== undefined) {
    if (!Array.isArray(children)) {
      issues.push({
        path: `${path}.children`,
        message: "children は Activity ID の配列である必要があります",
      });
    } else {
      for (const [index, childId] of children.entries()) {
        if (typeof childId !== "string") {
          issues.push({
            path: `${path}.children[${index}]`,
            message: "children の要素は Activity ID（文字列）である必要があります",
          });
        }
      }
    }
  }

  const responsibility = def["responsibility"];
  if (responsibility !== undefined && !isResponsibility(responsibility)) {
    issues.push({
      path: `${path}.responsibility`,
      message:
        "responsibility は文字列 / 数値 / 真偽値 / 配列 / オブジェクトのみからなるオブジェクトである必要があります",
    });
  }

  if (!isV1) {
    for (const field of V1_ACTIVITY_FIELDS) {
      if (def[field] !== undefined) {
        issues.push({
          path: `${path}.${field}`,
          message: `${field} は responsible.v1 のフィールドです（schemaVersion を "responsible.v1" にしてください）`,
        });
      }
    }
    return;
  }

  validateFactRefs(`${path}.requires`, def["requires"], issues);
  validateFactRefs(`${path}.ensures`, def["ensures"], issues);
  validateEffectDefs(`${path}.effects`, def["effects"], issues);
}

function validateFactRefs(path: string, value: unknown, issues: ValidationIssue[]): void {
  if (value === undefined) return;

  if (!Array.isArray(value)) {
    issues.push({ path, message: "事実参照（FactRef）の配列である必要があります" });
    return;
  }
  for (const [index, fact] of value.entries()) {
    if (typeof fact !== "string" || fact.length === 0) {
      issues.push({
        path: `${path}[${index}]`,
        message: "事実参照（FactRef）は空でない文字列である必要があります",
      });
    }
  }
}

function validateEffectDefs(path: string, value: unknown, issues: ValidationIssue[]): void {
  if (value === undefined) return;

  if (!Array.isArray(value)) {
    issues.push({ path, message: "effects は EffectDef の配列である必要があります" });
    return;
  }

  for (const [index, effect] of value.entries()) {
    const effectPath = `${path}[${index}]`;

    if (!isRecord(effect)) {
      issues.push({ path: effectPath, message: "effect はオブジェクトである必要があります" });
      continue;
    }

    if (
      effect["id"] !== undefined &&
      (typeof effect["id"] !== "string" || effect["id"].length === 0)
    ) {
      issues.push({
        path: `${effectPath}.id`,
        message: "id は空でない文字列である必要があります",
      });
    }

    const payload = effect["payload"];
    if (!isRecord(payload)) {
      issues.push({
        path: `${effectPath}.payload`,
        message: "payload はオブジェクトである必要があります",
      });
    } else {
      if (!EFFECT_PAYLOAD_KINDS.includes(payload["kind"] as EffectPayloadKind)) {
        issues.push({
          path: `${effectPath}.payload.kind`,
          message: `kind は ${EFFECT_PAYLOAD_KINDS.join(" / ")} のいずれかである必要があります`,
        });
      }
      if (typeof payload["schema"] !== "string" || payload["schema"].length === 0) {
        issues.push({
          path: `${effectPath}.payload.schema`,
          message: "schema は空でない文字列（スキーマ参照）である必要があります",
        });
      }
    }

    const delivery = effect["delivery"];
    if (!isRecord(delivery)) {
      issues.push({
        path: `${effectPath}.delivery`,
        message: "delivery はオブジェクトである必要があります",
      });
      continue;
    }
    const mode = delivery["mode"];
    if (!EFFECT_DELIVERY_MODES.includes(mode as (typeof EFFECT_DELIVERY_MODES)[number])) {
      issues.push({
        path: `${effectPath}.delivery.mode`,
        message: `mode は ${EFFECT_DELIVERY_MODES.join(" / ")} のいずれかである必要があります`,
      });
      continue;
    }
    if (mode === "directed") {
      const target = delivery["target"];
      if (!isResponsibility(target) || Object.keys(target).length === 0) {
        issues.push({
          path: `${effectPath}.delivery.target`,
          message:
            'directed の target は空でない Responsibility レコード（例: { "role": "Manager" }）である必要があります',
        });
      }
    }
  }
}

function validateFlowDef(
  index: number,
  flow: unknown,
  activityIds: ReadonlySet<Id>,
  issues: ValidationIssue[],
): void {
  const path = `$.flows[${index}]`;

  if (!isRecord(flow)) {
    issues.push({ path, message: "flow はオブジェクトである必要があります" });
    return;
  }

  for (const field of ["from", "to"] as const) {
    const fieldValue = flow[field];
    if (typeof fieldValue !== "string" || fieldValue.length === 0) {
      issues.push({
        path: `${path}.${field}`,
        message: `${field} は Activity ID（文字列）である必要があります`,
      });
    } else if (activityIds.size > 0 && !activityIds.has(fieldValue)) {
      issues.push({
        path: `${path}.${field}`,
        message: `${field} が未定義の Activity "${fieldValue}" を参照しています`,
      });
    }
  }
}

function validateViewDef(index: number, view: unknown, issues: ValidationIssue[]): void {
  const path = `$.views[${index}]`;

  if (!isRecord(view)) {
    issues.push({ path, message: "view はオブジェクトである必要があります" });
    return;
  }

  if (typeof view["id"] !== "string" || view["id"].length === 0) {
    issues.push({ path: `${path}.id`, message: "id は空でない文字列である必要があります" });
  }
  if (view["layout"] !== "lane") {
    issues.push({ path: `${path}.layout`, message: `layout は "lane" のみ対応しています` });
  }
  if (view["normalForm"] !== "responsibilityBoundary") {
    issues.push({
      path: `${path}.normalForm`,
      message: `normalForm は "responsibilityBoundary" のみ対応しています`,
    });
  }

  const boundary = view["boundary"];
  const isKey = (v: unknown): boolean => typeof v === "string" && v.length > 0;
  if (!isKey(boundary) && !(Array.isArray(boundary) && boundary.every(isKey))) {
    issues.push({
      path: `${path}.boundary`,
      message: "boundary は境界キー（文字列）またはその配列である必要があります",
    });
  }
}

function validateNoDecompositionCycle(
  activities: Readonly<Record<string, unknown>>,
  issues: ValidationIssue[],
): void {
  const visiting = new Set<Id>();
  const done = new Set<Id>();

  const childrenOf = (id: Id): readonly Id[] => {
    const def = activities[id];
    if (!isRecord(def) || !Array.isArray(def["children"])) return [];
    return def["children"].filter((childId): childId is Id => typeof childId === "string");
  };

  const visit = (id: Id): boolean => {
    if (done.has(id)) return false;
    if (visiting.has(id)) return true;
    visiting.add(id);
    for (const childId of childrenOf(id)) {
      if (activities[childId] === undefined) continue;
      if (visit(childId)) {
        visiting.delete(id);
        return true;
      }
    }
    visiting.delete(id);
    done.add(id);
    return false;
  };

  for (const id of Object.keys(activities)) {
    if (visit(id)) {
      issues.push({
        path: `$.activities.${id}.children`,
        message: "Activity の分解階層（children）に循環があります",
      });
      return;
    }
  }
}

function invalid(issues: readonly ValidationIssue[]): ValidationResult {
  return { ok: false, issues };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundaryValue(value: unknown): value is BoundaryValue {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return true;
  if (Array.isArray(value)) return value.every(isBoundaryValue);
  if (isRecord(value)) return Object.values(value).every(isBoundaryValue);
  return false;
}

function isResponsibility(value: unknown): value is Responsibility {
  return isRecord(value) && Object.values(value).every(isBoundaryValue);
}
