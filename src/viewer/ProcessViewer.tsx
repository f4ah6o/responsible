import { useCallback, useMemo, useRef, useState } from "react";

import {
  HIERARCHICAL_BOUNDARY_ORDER,
  canZoomIn,
  canZoomOut,
  leafActivityIds,
  projectByResponsibilityBoundary,
} from "../index.js";
import type {
  ActivityDef,
  BoundaryExpr,
  FlowDef,
  Id,
  ProcessModel,
  ProjectedActivity,
  ViewDef,
} from "../model.js";
import { sampleProcesses } from "../sample.js";
import { BoundaryZoomControl, type HeightMode } from "./BoundaryZoomControl";
import { FlowCanvas } from "./FlowCanvas";
import { HeightReportContext } from "./HeightReportContext";
import { ProcessSelect } from "./ProcessSelect";
import { projectionToFlow } from "./projectionToFlow";

const DEFAULT_ZOOM_LEVEL = 1;
const noop = () => {};

function sourceIdsOf(activity: ProjectedActivity): readonly Id[] {
  return activity.kind === "atomic" ? [activity.activityId] : activity.activityIds;
}

function scopedProcessModel(model: ProcessModel, leafIds: readonly Id[]): ProcessModel {
  const include = new Set(leafIds);
  const activities: Record<Id, ActivityDef> = {};
  for (const id of leafIds) {
    const activity = model.activities[id];
    if (activity) activities[id] = activity;
  }
  const flows: FlowDef[] = [];
  for (const flow of model.flows) {
    if (include.has(flow.from) && include.has(flow.to)) flows.push(flow);
  }
  return { schemaVersion: model.schemaVersion, activities, flows };
}

function firstLeafId(model: ProcessModel, rootId: Id): Id | undefined {
  return leafActivityIds(model, rootId)[0];
}

function hasChildren(activity: ActivityDef | undefined): boolean {
  return (activity?.children?.length ?? 0) > 0;
}

function scopeOptions(model: ProcessModel, scopeId: Id): ActivityDef[] {
  const current = model.activities[scopeId];
  return (current?.children ?? [])
    .map((id) => model.activities[id])
    .filter((activity): activity is ActivityDef => hasChildren(activity));
}

function lastValidScopePath(model: ProcessModel, scopePath: readonly Id[], rootId: Id): Id[] {
  const valid: Id[] = [];
  for (const id of scopePath) {
    if (!model.activities[id]) break;
    valid.push(id);
  }
  return valid.length > 0 ? valid : [rootId];
}

type ScopeControlProps = {
  model: ProcessModel;
  scopePath: readonly Id[];
  onSelectAncestor: (index: number) => void;
  onDrillDown: (id: Id) => void;
  error?: string | undefined;
};

function ScopeControl({
  model,
  scopePath,
  onSelectAncestor,
  onDrillDown,
  error,
}: ScopeControlProps) {
  const currentScopeId = scopePath[scopePath.length - 1]!;
  const options = scopeOptions(model, currentScopeId);

  return (
    <section className="scope-control" aria-label="Activity decomposition scope">
      <div className="scope-breadcrumb" aria-label="現在の表示スコープ">
        {scopePath.map((id, index) => {
          const activity = model.activities[id];
          const label = activity?.name ?? id;
          const current = index === scopePath.length - 1;
          return (
            <button
              key={id}
              className={current ? "scope-current" : "scope-ancestor"}
              onClick={!current ? () => onSelectAncestor(index) : undefined}
              disabled={current}
            >
              {label}
            </button>
          );
        })}
      </div>
      <select
        value=""
        onChange={(event) => {
          if (event.target.value) onDrillDown(event.target.value);
        }}
        disabled={options.length === 0}
        aria-label="下位スコープへ移動"
      >
        <option value="">分解先</option>
        {options.map((activity) => (
          <option key={activity.id} value={activity.id}>
            {activity.name ?? activity.id}
          </option>
        ))}
      </select>
      {error && <span className="scope-error">{error}</span>}
    </section>
  );
}

export function ProcessViewer() {
  const [processIndex, setProcessIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM_LEVEL);
  const [scopePath, setScopePath] = useState<Id[]>(() => [sampleProcesses[0]!.rootActivityId]);
  const [scopeError, setScopeError] = useState<string | undefined>();
  const [heightMode, setHeightMode] = useState<HeightMode>("estimated");
  const [measuredHeights, setMeasuredHeights] = useState<ReadonlyMap<string, number>>(new Map());
  const pendingHeights = useRef<Map<string, number>>(new Map());
  const initialSample = sampleProcesses[0]!;
  const [selectedLeafId, setSelectedLeafId] = useState<Id | undefined>(() =>
    firstLeafId(initialSample.model, initialSample.rootActivityId),
  );

  const sample = sampleProcesses[processIndex] ?? initialSample;
  const model = sample.model;
  const rootId = sample.rootActivityId;
  const validScopePath = lastValidScopePath(model, scopePath, rootId);
  const currentScopeId = validScopePath[validScopePath.length - 1] ?? rootId;

  // Project by full path up to zoom level so composites never cross ancestor boundaries
  const boundary: BoundaryExpr = HIERARCHICAL_BOUNDARY_ORDER.slice(0, zoomLevel + 1);

  const projected = useMemo(() => {
    const scoped = scopedProcessModel(model, leafActivityIds(model, currentScopeId));
    const view: ViewDef = {
      id: "current",
      layout: "lane",
      boundary,
      normalForm: "responsibilityBoundary",
    };
    return projectByResponsibilityBoundary(scoped, view);
  }, [model, currentScopeId, boundary]);

  const activeHeights = heightMode === "measured" ? measuredHeights : undefined;

  const flow = useMemo(
    () => projectionToFlow(projected, model.activities, selectedLeafId, zoomLevel, activeHeights),
    [projected, model, selectedLeafId, zoomLevel, activeHeights],
  );

  const handleHeightMeasured = useCallback((id: string, height: number) => {
    pendingHeights.current.set(id, height);
    // batch: flush on next animation frame to avoid per-card re-renders
    requestAnimationFrame(() => {
      if (pendingHeights.current.size === 0) return;
      setMeasuredHeights((prev) => {
        const next = new Map(prev);
        for (const [k, v] of pendingHeights.current) next.set(k, v);
        pendingHeights.current = new Map();
        return next;
      });
    });
  }, []);

  const handleToggleHeightMode = useCallback(() => {
    setHeightMode((m) => (m === "estimated" ? "measured" : "estimated"));
  }, []);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const node = projected.activities.find((activity) => activity.id === nodeId);
      if (!node) return;
      setSelectedLeafId(sourceIdsOf(node)[0]);
    },
    [projected],
  );

  const handleProcessChange = useCallback((id: string) => {
    const index = sampleProcesses.findIndex((process) => process.id === id);
    if (index === -1) return;
    const next = sampleProcesses[index]!;
    setProcessIndex(index);
    setScopePath([next.rootActivityId]);
    setScopeError(undefined);
    setSelectedLeafId(firstLeafId(next.model, next.rootActivityId));
    setMeasuredHeights(new Map());
    pendingHeights.current = new Map();
  }, []);

  const handleSelectAncestor = useCallback((index: number) => {
    setScopePath((path) => path.slice(0, index + 1));
    setScopeError(undefined);
    setMeasuredHeights(new Map());
    pendingHeights.current = new Map();
  }, []);

  const handleDrillDown = useCallback(
    (id: Id) => {
      const leafIds = leafActivityIds(model, id);
      const view: ViewDef = {
        id: "candidate",
        layout: "lane",
        boundary,
        normalForm: "responsibilityBoundary",
      };

      try {
        projectByResponsibilityBoundary(scopedProcessModel(model, leafIds), view);
      } catch (error) {
        setScopeError(error instanceof Error ? error.message : String(error));
        return;
      }

      setScopePath((path) => [...lastValidScopePath(model, path, rootId), id]);
      setScopeError(undefined);
      setSelectedLeafId(leafIds[0]);
      setMeasuredHeights(new Map());
      pendingHeights.current = new Map();
    },
    [boundary, model, rootId],
  );

  const handleZoomIn = useCallback(() => {
    setZoomLevel((level) => (canZoomIn(level) ? level + 1 : level));
    setMeasuredHeights(new Map());
    pendingHeights.current = new Map();
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoomLevel((level) => (canZoomOut(level) ? level - 1 : level));
    setMeasuredHeights(new Map());
    pendingHeights.current = new Map();
  }, []);

  return (
    <HeightReportContext.Provider value={heightMode === "measured" ? handleHeightMeasured : noop}>
      <main className="shell">
        <FlowCanvas
          nodes={flow.nodes}
          edges={flow.edges}
          onNodeClick={handleNodeClick}
          toolbar={
            <>
              <ProcessSelect
                processes={sampleProcesses}
                value={sample.id}
                onChange={handleProcessChange}
              />
              <BoundaryZoomControl
                level={zoomLevel}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                heightMode={heightMode}
                onToggleHeightMode={handleToggleHeightMode}
              />
              <ScopeControl
                model={model}
                scopePath={validScopePath}
                onSelectAncestor={handleSelectAncestor}
                onDrillDown={handleDrillDown}
                error={scopeError}
              />
            </>
          }
        />
      </main>
    </HeightReportContext.Provider>
  );
}
