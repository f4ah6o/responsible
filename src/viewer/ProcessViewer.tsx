import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  HIERARCHICAL_BOUNDARY_ORDER,
  canZoomIn,
  canZoomOut,
  clampZoomLevel,
  ensureRootActivity,
  leafActivityIds,
  parseProcessModelJson,
  projectDagByResponsibilityBoundary,
  projectEffects,
} from "../index.js";
import type {
  ActivityDef,
  BoundaryExpr,
  FlowDef,
  Id,
  ProcessModel,
  ProcessView,
  ProjectedActivity,
  ViewDef,
} from "../model.js";
import { sampleProcesses, type SampleProcess } from "../sample.js";
import { BoundaryZoomControl } from "./BoundaryZoomControl";
import { FlowCanvas } from "./FlowCanvas";
import { SizeReportContext, type MeasuredSize } from "./SizeReportContext";
import { ModelLoader } from "./ModelLoader";
import { ProcessSelect } from "./ProcessSelect";
import { projectionToFlow } from "./projectionToFlow";
import { readViewerUrlState, writeViewerUrlState } from "./urlState";
import { useI18n, type Locale } from "./i18n";

const DEFAULT_ZOOM_LEVEL = 1;

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
    if (valid.length === 0) {
      if (id !== rootId) break;
    } else {
      const parent = model.activities[valid[valid.length - 1]!];
      if (!parent?.children?.includes(id)) break;
    }
    valid.push(id);
  }
  return valid.length > 0 ? valid : [rootId];
}

type ProjectionResult =
  | Readonly<{ view: ProcessView; error?: undefined }>
  | Readonly<{ view?: undefined; error: string }>;

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
  const { t } = useI18n();
  const currentScopeId = scopePath[scopePath.length - 1]!;
  const options = scopeOptions(model, currentScopeId);

  return (
    <section className="scope-control" aria-label="Activity decomposition scope">
      <div className="scope-breadcrumb" aria-label={t("scopeBreadcrumbAriaLabel")}>
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
        aria-label={t("scopeDrillDownAriaLabel")}
      >
        <option value="">{t("scopeSelectPlaceholder")}</option>
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

type LocaleToggleProps = {
  locale: Locale;
  onChange: (locale: Locale) => void;
};

function LocaleToggle({ locale, onChange }: LocaleToggleProps) {
  const { t } = useI18n();
  return (
    <div className="locale-toggle" role="group" aria-label={t("localeToggleAriaLabel")}>
      <button
        type="button"
        className={locale === "ja" ? "locale-current" : "locale-option"}
        onClick={() => onChange("ja")}
        disabled={locale === "ja"}
      >
        JA
      </button>
      <button
        type="button"
        className={locale === "en" ? "locale-current" : "locale-option"}
        onClick={() => onChange("en")}
        disabled={locale === "en"}
      >
        EN
      </button>
    </div>
  );
}

const initialUrlState = readViewerUrlState(typeof window === "undefined" ? "" : location.hash);

const initialProcess: SampleProcess =
  sampleProcesses.find((process) => process.id === initialUrlState.processId) ??
  sampleProcesses[0]!;

export function ProcessViewer() {
  const { t, locale, setLocale } = useI18n();
  const [processes, setProcesses] = useState<readonly SampleProcess[]>(sampleProcesses);
  const [processId, setProcessId] = useState(initialProcess.id);
  const [zoomLevel, setZoomLevel] = useState(() =>
    initialUrlState.zoomLevel === undefined
      ? DEFAULT_ZOOM_LEVEL
      : clampZoomLevel(initialUrlState.zoomLevel),
  );
  const [scopePath, setScopePath] = useState<readonly Id[]>(() =>
    initialUrlState.processId === initialProcess.id && initialUrlState.scopePath
      ? initialUrlState.scopePath
      : [initialProcess.rootActivityId],
  );
  const [scopeError, setScopeError] = useState<string | undefined>();
  const [importError, setImportError] = useState<string | undefined>();
  // Lane frames always follow measured card sizes (ResizeObserver): an expanded
  // composite grows its lane's height, and the canvas widens when a fold needs
  // more sideways room than the flow grid provides.
  const [measuredSizes, setMeasuredSizes] = useState<ReadonlyMap<string, MeasuredSize>>(new Map());
  const pendingSizes = useRef<Map<string, MeasuredSize>>(new Map());
  const [selectedLeafId, setSelectedLeafId] = useState<Id | undefined>(() =>
    firstLeafId(initialProcess.model, initialProcess.rootActivityId),
  );

  const sample = processes.find((process) => process.id === processId) ?? processes[0]!;
  const model = sample.model;
  const rootId = sample.rootActivityId;
  const validScopePath = lastValidScopePath(model, scopePath, rootId);
  const currentScopeId = validScopePath[validScopePath.length - 1] ?? rootId;

  // Project by full path up to zoom level so composites never cross ancestor boundaries
  const boundary: BoundaryExpr = HIERARCHICAL_BOUNDARY_ORDER.slice(0, zoomLevel + 1);

  const projection = useMemo<ProjectionResult>(() => {
    const scoped = scopedProcessModel(model, leafActivityIds(model, currentScopeId));
    const view: ViewDef = {
      id: "current",
      layout: "lane",
      boundary,
      normalForm: "responsibilityBoundary",
    };
    try {
      return { view: projectDagByResponsibilityBoundary(scoped, view) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [model, currentScopeId, boundary]);

  // Effects resolve against the full model (not the scoped one) so a directed
  // target outside the drill-down scope stays a known boundary; its edge then
  // simply has no lane in the view and degrades to a node badge.
  const effectProjection = useMemo(
    () => projectEffects(model, boundary, currentScopeId),
    [model, boundary, currentScopeId],
  );
  const effects = effectProjection.ok ? effectProjection.effects : undefined;
  const effectIssues = effectProjection.ok ? undefined : effectProjection.issues;

  const projected = projection.view;

  const flow = useMemo(
    () =>
      projected
        ? projectionToFlow(
            projected,
            model.activities,
            selectedLeafId,
            zoomLevel,
            measuredSizes,
            effects,
          )
        : { nodes: [], edges: [], lanes: [] },
    [projected, model, selectedLeafId, zoomLevel, measuredSizes, effects],
  );

  const scopeKey = validScopePath.join(",");
  useEffect(() => {
    const hash = writeViewerUrlState({
      processId,
      zoomLevel,
      scopePath: scopeKey.split(","),
    });
    history.replaceState(null, "", `${location.pathname}${location.search}${hash}`);
  }, [processId, zoomLevel, scopeKey]);

  const resetSizes = useCallback(() => {
    setMeasuredSizes(new Map());
    pendingSizes.current = new Map();
  }, []);

  const handleSizeMeasured = useCallback((id: string, size: MeasuredSize) => {
    pendingSizes.current.set(id, size);
    // batch: flush on next animation frame to avoid per-card re-renders
    requestAnimationFrame(() => {
      if (pendingSizes.current.size === 0) return;
      setMeasuredSizes((prev) => {
        const next = new Map(prev);
        for (const [k, v] of pendingSizes.current) next.set(k, v);
        pendingSizes.current = new Map();
        return next;
      });
    });
  }, []);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const node = projected?.activities.find((activity) => activity.id === nodeId);
      if (!node) return;
      setSelectedLeafId(sourceIdsOf(node)[0]);
    },
    [projected],
  );

  const selectProcess = useCallback(
    (process: SampleProcess) => {
      setProcessId(process.id);
      setScopePath([process.rootActivityId]);
      setScopeError(undefined);
      setSelectedLeafId(firstLeafId(process.model, process.rootActivityId));
      resetSizes();
    },
    [resetSizes],
  );

  const handleProcessChange = useCallback(
    (id: string) => {
      const process = processes.find((candidate) => candidate.id === id);
      if (process) selectProcess(process);
    },
    [processes, selectProcess],
  );

  const handleLoadFile = useCallback(
    (file: File) => {
      file
        .text()
        .then((text) => {
          const result = parseProcessModelJson(text);
          if (!result.ok) {
            const shown = result.issues
              .slice(0, 3)
              .map((issue) => `${issue.path}: ${issue.message}`)
              .join(" / ");
            const rest = result.issues.length - 3;
            setImportError(
              t("importError", {
                fileName: file.name,
                issues: `${shown}${rest > 0 ? t("importErrorMore", { count: rest }) : ""}`,
              }),
            );
            return;
          }

          const rooted = ensureRootActivity(result.model);
          const title = file.name.replace(/\.json$/i, "") || file.name;
          const imported: SampleProcess = {
            id: `imported:${title}:${Date.now()}`,
            title: t("importedTitleSuffix", { title }),
            rootActivityId: rooted.rootActivityId,
            model: rooted.model,
          };
          setProcesses((prev) => [...prev, imported]);
          setImportError(undefined);
          selectProcess(imported);
        })
        .catch((error: unknown) => {
          setImportError(
            t("importError", {
              fileName: file.name,
              issues: error instanceof Error ? error.message : String(error),
            }),
          );
        });
    },
    [selectProcess, t],
  );

  const handleSelectAncestor = useCallback(
    (index: number) => {
      setScopePath((path) => path.slice(0, index + 1));
      setScopeError(undefined);
      resetSizes();
    },
    [resetSizes],
  );

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
        projectDagByResponsibilityBoundary(scopedProcessModel(model, leafIds), view);
      } catch (error) {
        setScopeError(error instanceof Error ? error.message : String(error));
        return;
      }

      setScopePath((path) => [...lastValidScopePath(model, path, rootId), id]);
      setScopeError(undefined);
      setSelectedLeafId(leafIds[0]);
      resetSizes();
    },
    [boundary, model, rootId, resetSizes],
  );

  const handleZoomIn = useCallback(() => {
    setZoomLevel((level) => (canZoomIn(level) ? level + 1 : level));
    resetSizes();
  }, [resetSizes]);
  const handleZoomOut = useCallback(() => {
    setZoomLevel((level) => (canZoomOut(level) ? level - 1 : level));
    resetSizes();
  }, [resetSizes]);

  return (
    <SizeReportContext.Provider value={handleSizeMeasured}>
      <main className="shell">
        <FlowCanvas
          nodes={flow.nodes}
          edges={flow.edges}
          onNodeClick={handleNodeClick}
          overlay={
            projection.error && (
              <div className="projection-error" role="alert">
                <strong>{t("scopeUnavailable")}</strong>
                <p>{projection.error}</p>
              </div>
            )
          }
          notice={
            effectIssues && (
              <div className="effect-issues" role="alert">
                <strong>{t("effectUnavailable")}</strong>
                <p>
                  {effectIssues
                    .slice(0, 3)
                    .map((issue) => `${issue.path}: ${issue.message}`)
                    .join(" / ")}
                  {effectIssues.length > 3
                    ? t("effectIssuesMore", { count: effectIssues.length - 3 })
                    : ""}
                </p>
              </div>
            )
          }
          toolbar={
            <>
              <ProcessSelect
                processes={processes}
                value={sample.id}
                onChange={handleProcessChange}
              />
              <BoundaryZoomControl
                level={zoomLevel}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
              />
              <ScopeControl
                model={model}
                scopePath={validScopePath}
                onSelectAncestor={handleSelectAncestor}
                onDrillDown={handleDrillDown}
                error={scopeError}
              />
              <ModelLoader onLoadFile={handleLoadFile} error={importError} />
              {effects && effects.length > 0 && (
                <span className="effect-legend">
                  <span className="legend-dash" aria-hidden="true" />
                  {t("effectLegend")}
                </span>
              )}
              <LocaleToggle locale={locale} onChange={setLocale} />
            </>
          }
        />
      </main>
    </SizeReportContext.Provider>
  );
}
