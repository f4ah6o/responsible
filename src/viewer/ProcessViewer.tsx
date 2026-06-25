import { useCallback, useMemo, useState } from "react";

import {
  HIERARCHICAL_BOUNDARY_ORDER,
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
import { BoundaryZoomControl } from "./BoundaryZoomControl";
import { FlowCanvas } from "./FlowCanvas";
import { Inspector } from "./Inspector";
import { ProcessSelect } from "./ProcessSelect";
import { projectionToFlow } from "./projectionToFlow";

const DEFAULT_ZOOM_LEVEL = 1;

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
  const initialSample = sampleProcesses[0]!;
  const [selectedLeafId, setSelectedLeafId] = useState<Id | undefined>(() =>
    firstLeafId(initialSample.model, initialSample.rootActivityId),
  );

  const sample = sampleProcesses[processIndex] ?? initialSample;
  const model = sample.model;
  const rootId = sample.rootActivityId;

  const boundary: BoundaryExpr = boundaryForLevel(zoomLevel);
  const boundaryKey = HIERARCHICAL_BOUNDARY_ORDER[zoomLevel] ?? "boundary";

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

  const flow = useMemo(
    () => projectionToFlow(projected, model.activities, selectedLeafId),
    [projected, model, selectedLeafId],
  );

  const selectedNode = useMemo(
    () =>
      projected.activities.find((activity) => sourceIdsOf(activity).includes(selectedLeafId ?? "")),
    [projected, selectedLeafId],
  );

  const leafCount = useMemo(() => leafIdsUnder(model, rootId).length, [model, rootId]);

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
  }, []);

  const handleZoomIn = useCallback(
    () => setZoomLevel((level) => (canZoomIn(level) ? level + 1 : level)),
    [],
  );
  const handleZoomOut = useCallback(
    () => setZoomLevel((level) => (canZoomOut(level) ? level - 1 : level)),
    [],
  );

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">responsible reference implementation</p>
          <h1>Activity と責任境界で業務プロセスを可視化する</h1>
          <p className="lead">
            Activity を node、責任境界を Lane、Lane をまたぐ接続を責任境界越えとして 1
            画面で表示する。 viewport の pan / zoom で全体俯瞰と詳細確認を切り替え、boundary zoom
            で責任境界レベルを切り替える。
          </p>
        </div>
        <div className="summary-card" aria-label="model summary">
          <span>{leafCount}</span>
          <small>leaf activities</small>
          <span>{projected.activities.length}</span>
          <small>projected nodes</small>
        </div>
      </header>
      <nav className="toolbar" aria-label="viewer controls">
        <ProcessSelect
          processes={sampleProcesses}
          value={sample.id}
          onChange={handleProcessChange}
        />
        <div className="boundary-key-readout">
          <span>boundary level</span>
          <strong>{boundaryKey}</strong>
        </div>
      </nav>
      <BoundaryZoomControl level={zoomLevel} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />
      <section className="viewer-screen" aria-label="Process viewer">
        <FlowCanvas nodes={flow.nodes} edges={flow.edges} onNodeClick={handleNodeClick} />
        <Inspector
          activity={selectedNode}
          activities={model.activities}
          boundaryKey={boundaryKey}
        />
      </section>
    </main>
  );
}
