export type Id = string;
export type TypeRef = string;
export type SchemaVersion = "responsible.v0" | "responsible.v1";
export type BoundaryKey = string;
export type BoundaryValue =
  | string
  | number
  | boolean
  | readonly BoundaryValue[]
  | { readonly [key: string]: BoundaryValue };

export type Responsibility = Readonly<Record<BoundaryKey, BoundaryValue>>;

export type ActivityStatus = "discovered" | "defined" | "validated" | "automatable";

// Opaque fact reference (responsible.v1), e.g. "Application.status = submitted".
// No equality or implication semantics is defined; see docs/responsible-v1.md.
export type FactRef = string;

export type EffectPayloadKind = "domain-fact" | "command" | "data";

export type EffectPayloadDef = Readonly<{
  kind: EffectPayloadKind;
  schema: string;
}>;

// A directed target is a Responsibility record, not a BoundaryId: the model
// document stays boundary-expression-independent and the target is resolved
// with the same rule as Activities at projection time.
export type EffectDeliveryDef =
  | Readonly<{ mode: "directed"; target: Responsibility }>
  | Readonly<{ mode: "broadcast" }>
  | Readonly<{ mode: "observable" }>;

// Declarative effect (responsible.v1). `source` is never declared: the
// producing Activity is the declaring one, and its boundary is derived at
// projection time.
export type EffectDef = Readonly<{
  id?: Id;
  payload: EffectPayloadDef;
  delivery: EffectDeliveryDef;
}>;

export type ActivityDef = Readonly<{
  id: Id;
  name?: string;
  input: TypeRef;
  output: TypeRef;
  responsibility?: Responsibility;
  children?: readonly Id[];
  status?: ActivityStatus;
  requires?: readonly FactRef[]; // responsible.v1
  ensures?: readonly FactRef[]; // responsible.v1
  effects?: readonly EffectDef[]; // responsible.v1
}>;

export type FlowDef = Readonly<{
  id?: Id;
  from: Id;
  to: Id;
  mapping?: string;
  contract?: string;
}>;

export type PrimitiveTypeDef = Readonly<{
  kind: "primitive";
  name?: string;
}>;

export type FieldDef = Readonly<{
  type: TypeRef;
  required?: boolean;
}>;

export type RecordTypeDef = Readonly<{
  kind: "record";
  fields: Readonly<Record<string, FieldDef>>;
}>;

export type UnionTypeDef = Readonly<{
  kind: "union";
  variants: Readonly<Record<string, TypeRef>>;
}>;

export type ResultTypeDef = Readonly<{
  kind: "result";
  ok: TypeRef;
  error: TypeRef;
}>;

export type TypeDef = PrimitiveTypeDef | RecordTypeDef | UnionTypeDef | ResultTypeDef;

export type BoundaryExpr = BoundaryKey | readonly BoundaryKey[];

export type ViewDef = Readonly<{
  id: Id;
  layout: "lane";
  boundary: BoundaryExpr;
  normalForm: "responsibilityBoundary";
}>;

export type ProcessModel = Readonly<{
  schemaVersion: SchemaVersion;
  activities: Readonly<Record<Id, ActivityDef>>;
  types?: Readonly<Record<Id, TypeDef>>;
  flows: readonly FlowDef[];
  views?: readonly ViewDef[];
}>;

export type CompositeActivity = Readonly<{
  id: Id;
  kind: "composite";
  activityIds: readonly Id[];
  boundary: string;
  input: TypeRef;
  output: TypeRef;
}>;

export type AtomicActivity = Readonly<{
  id: Id;
  kind: "atomic";
  activityId: Id;
  boundary: string;
  input: TypeRef;
  output: TypeRef;
}>;

export type ProjectedActivity = AtomicActivity | CompositeActivity;

export type ProjectedFlow = Readonly<{
  from: Id;
  to: Id;
}>;

export type ProcessView = Readonly<{
  view: ViewDef;
  activities: readonly ProjectedActivity[];
  flows: readonly ProjectedFlow[];
}>;
