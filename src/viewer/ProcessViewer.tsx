import { useCallback, useMemo, useRef, useState } from "react";

import {
  boundaryForLevel,
  canZoomIn,
  canZoomOut,
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

function leafIdsUnder(model: ProcessModel, id: Id, seen = new Set<Id>()): Id[] {
  if (seen.has(id)) return [];
  seen.add(id);
  const activity = model.activities[id];
  if (!activity) return [];
  const children = activity.children ?? [];
  if (children.length === 0) return [id];
  return children.flatMap((childId) => leafIdsUnder(model, childId, seen));
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
  return leafIdsUnder(model, rootId)[0];
}

export function ProcessViewer() {
  const [processIndex, setProcessIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM_LEVEL);
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

  const boundary: BoundaryExpr = boundaryForLevel(zoomLevel);

  const projected = useMemo(() => {
    const scoped = scopedProcessModel(model, leafIdsUnder(model, rootId));
    const view: ViewDef = {
      id: "current",
      layout: "lane",
      boundary,
      normalForm: "responsibilityBoundary",
    };
    return projectByResponsibilityBoundary(scoped, view);
  }, [model, rootId, boundary]);

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
    setSelectedLeafId(firstLeafId(next.model, next.rootActivityId));
    setMeasuredHeights(new Map());
    pendingHeights.current = new Map();
  }, []);

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
            </>
          }
        />
      </main>
    </HeightReportContext.Provider>
  );
}
