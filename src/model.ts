export type Id = string;
export type TypeRef = string;
export type BoundaryKey = string;
export type BoundaryValue = string | number | boolean | readonly BoundaryValue[] | { readonly [key: string]: BoundaryValue };

export type Responsibility = Readonly<Record<BoundaryKey, BoundaryValue>>;

export type ActivityStatus =
  | "discovered"
  | "defined"
  | "validated"
  | "automatable";

export type ActivityDef = Readonly<{
  id: Id;
  name?: string;
  input: TypeRef;
  output: TypeRef;
  responsibility?: Responsibility;
  children?: readonly Id[];
  status?: ActivityStatus;
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
  schemaVersion: "responsible.v0";
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
