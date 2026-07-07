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
import { BoundaryZoomControl, boundaryLabelFor } from "./BoundaryZoomControl";
import { ExportControl } from "./ExportControl";
import { FlowCanvas } from "./FlowCanvas";
import { SizeReportContext, type MeasuredSize } from "./SizeReportContext";
import { ModelLoader } from "./ModelLoader";
import { ProcessSelect, type ProcessSelectErrorEntry } from "./ProcessSelect";
import { projectionToFlow } from "./projectionToFlow";
import {
  decodeModelParam,
  encodeModelParam,
  readViewerUrlState,
  writeViewerUrlState,
} from "./urlState";
import {
  addStoredImportedModel,
  loadStoredImportedModels,
  removeStoredImportedModel,
} from "./storage";
import { useI18n, type I18n, type Locale } from "./i18n";

const DEFAULT_ZOOM_LEVEL = 1;
const IMPORTED_ID_PREFIX = "imported:";
const SHARE_URL_LENGTH_LIMIT = 8000;

type ShareStatus =
  | Readonly<{ kind: "copied" }>
  | Readonly<{ kind: "error"; message: string }>
  | undefined;

type ImportOutcome =
  | Readonly<{ ok: true; process: SampleProcess; json: string }>
  | Readonly<{ ok: false; error: string }>;

function buildImportedProcess(json: string, titleHint: string, t: I18n["t"]): ImportOutcome {
  const result = parseProcessModelJson(json);
  if (!result.ok) {
    const shown = result.issues
      .slice(0, 3)
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join(" / ");
    const rest = result.issues.length - 3;
    return {
      ok: false,
      error: t("importError", {
        fileName: titleHint,
        issues: `${shown}${rest > 0 ? t("importErrorMore", { count: rest }) : ""}`,
      }),
    };
  }

  const rooted = ensureRootActivity(result.model);
  const process: SampleProcess = {
    id: `${IMPORTED_ID_PREFIX}${titleHint}:${Date.now()}`,
    title: t("importedTitleSuffix", { title: titleHint }),
    rootActivityId: rooted.rootActivityId,
    model: rooted.model,
  };
  return { ok: true, process, json };
}

function hydratePersistedProcesses(): {
  processes: readonly SampleProcess[];
  errors: readonly ProcessSelectErrorEntry[];
} {
  const processes: SampleProcess[] = [];
  const errors: ProcessSelectErrorEntry[] = [];
  for (const stored of loadStoredImportedModels()) {
    const result = parseProcessModelJson(stored.json);
    if (!result.ok) {
      errors.push({ id: stored.id, title: stored.title });
      continue;
    }
    const rooted = ensureRootActivity(result.model);
    processes.push({
      id: stored.id,
      title: stored.title,
      rootActivityId: rooted.rootActivityId,
      model: rooted.model,
    });
  }
  return { processes, errors };
}

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

const { processes: initialPersistedProcesses, errors: initialImportErrors } =
  hydratePersistedProcesses();
const initialProcesses: readonly SampleProcess[] = [
  ...sampleProcesses,
  ...initialPersistedProcesses,
];

// A `#m=` link carries its own model and is decoded asynchronously after
// mount, so it always overrides `#p=` — the initial synchronous render just
// shows a placeholder process until the decode effect swaps it in.
const initialProcess: SampleProcess =
  (!initialUrlState.modelParam &&
    initialProcesses.find((process) => process.id === initialUrlState.processId)) ||
  initialProcesses[0]!;

export function ProcessViewer() {
  const { t, locale, setLocale } = useI18n();
  const [processes, setProcesses] = useState<readonly SampleProcess[]>(initialProcesses);
  const [processId, setProcessId] = useState(initialProcess.id);
  const [zoomLevel, setZoomLevel] = useState(() =>
    initialUrlState.zoomLevel === undefined
      ? DEFAULT_ZOOM_LEVEL
      : clampZoomLevel(initialUrlState.zoomLevel),
  );
  const [scopePath, setScopePath] = useState<readonly Id[]>(() =>
    !initialUrlState.modelParam &&
    initialUrlState.processId === initialProcess.id &&
    initialUrlState.scopePath
      ? initialUrlState.scopePath
      : [initialProcess.rootActivityId],
  );
  const [scopeError, setScopeError] = useState<string | undefined>();
  const [importError, setImportError] = useState<string | undefined>();
  const [importErrors, setImportErrors] =
    useState<readonly ProcessSelectErrorEntry[]>(initialImportErrors);
  const [sharedModelError, setSharedModelError] = useState<string | undefined>();
  const [sharedModelPending, setSharedModelPending] = useState(Boolean(initialUrlState.modelParam));
  const [shareStatus, setShareStatus] = useState<ShareStatus>();
  // Lane frames always follow measured card sizes (ResizeObserver): an expanded
  // composite grows its lane's height, and the canvas widens when a fold needs
  // more sideways room than the flow grid provides.
  const [measuredSizes, setMeasuredSizes] = useState<ReadonlyMap<string, MeasuredSize>>(new Map());
  const pendingSizes = useRef<Map<string, MeasuredSize>>(new Map());
  const [selectedLeafId, setSelectedLeafId] = useState<Id | undefined>(() =>
    firstLeafId(initialProcess.model, initialProcess.rootActivityId),
  );
  const canvasRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!shareStatus) return;
    const timer = setTimeout(
      () => setShareStatus(undefined),
      shareStatus.kind === "copied" ? 2000 : 6000,
    );
    return () => clearTimeout(timer);
  }, [shareStatus]);

  const resetSizes = useCallback(() => {
    setMeasuredSizes(new Map());
    pendingSizes.current = new Map();
  }, []);

  // A broken `#m=` value surfaces as an in-place error rather than a blank canvas.
  useEffect(() => {
    const modelParam = initialUrlState.modelParam;
    if (!modelParam) return;
    let cancelled = false;
    decodeModelParam(modelParam)
      .then((json) => {
        if (cancelled) return;
        // Reuse an already-persisted entry with identical content so revisiting
        // the same share link repeatedly doesn't grow localStorage without bound.
        const reused = loadStoredImportedModels().find((item) => item.json === json);
        const outcome = buildImportedProcess(json, t("sharedModelTitle"), t);
        if (!outcome.ok) {
          setSharedModelError(outcome.error);
          return;
        }
        const process: SampleProcess = reused
          ? { ...outcome.process, id: reused.id, title: reused.title }
          : outcome.process;
        if (!reused) {
          addStoredImportedModel({
            id: process.id,
            title: process.title,
            json: outcome.json,
            importedAt: Date.now(),
          });
        }
        setProcesses((prev) =>
          prev.some((existing) => existing.id === process.id) ? prev : [...prev, process],
        );
        setProcessId(process.id);
        const scope = initialUrlState.scopePath;
        setScopePath(scope && scope.length > 0 ? scope : [process.rootActivityId]);
        setSelectedLeafId(firstLeafId(process.model, process.rootActivityId));
        resetSizes();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSharedModelError(
          t("sharedModelLoadError", {
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      })
      .finally(() => {
        if (!cancelled) setSharedModelPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resetSizes, t]);

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
          const title = file.name.replace(/\.json$/i, "") || file.name;
          const outcome = buildImportedProcess(text, title, t);
          if (!outcome.ok) {
            setImportError(outcome.error);
            return;
          }
          addStoredImportedModel({
            id: outcome.process.id,
            title: outcome.process.title,
            json: outcome.json,
            importedAt: Date.now(),
          });
          setProcesses((prev) => [...prev, outcome.process]);
          setImportError(undefined);
          selectProcess(outcome.process);
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

  const handleDeleteImported = useCallback(() => {
    removeStoredImportedModel(sample.id);
    setProcesses((prev) => prev.filter((process) => process.id !== sample.id));
    selectProcess(sampleProcesses[0]!);
  }, [sample.id, selectProcess]);

  const handleDeleteImportError = useCallback((id: string) => {
    removeStoredImportedModel(id);
    setImportErrors((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const handleCopyShareLink = useCallback(async () => {
    if (sharedModelPending) {
      setShareStatus({ kind: "error", message: t("shareLoadingError") });
      return;
    }

    let modelParam: string | undefined;
    if (sample.id.startsWith(IMPORTED_ID_PREFIX)) {
      const stored = loadStoredImportedModels().find((item) => item.id === sample.id);
      const json = stored?.json ?? JSON.stringify(sample.model);
      try {
        modelParam = await encodeModelParam(json);
      } catch (error) {
        setShareStatus({
          kind: "error",
          message: t("shareGenerateError", {
            message: error instanceof Error ? error.message : String(error),
          }),
        });
        return;
      }
    }

    const hash = writeViewerUrlState({
      processId: sample.id,
      zoomLevel,
      scopePath: validScopePath,
      ...(modelParam ? { modelParam } : {}),
    });
    const url = `${location.origin}${location.pathname}${location.search}${hash}`;

    if (url.length > SHARE_URL_LENGTH_LIMIT) {
      setShareStatus({ kind: "error", message: t("shareTooLargeError") });
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareStatus({ kind: "copied" });
    } catch (error) {
      setShareStatus({
        kind: "error",
        message: t("shareClipboardError", {
          message: error instanceof Error ? error.message : String(error),
        }),
      });
    }
  }, [sample, zoomLevel, validScopePath, sharedModelPending, t]);

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
          ref={canvasRef}
          nodes={flow.nodes}
          edges={flow.edges}
          onNodeClick={handleNodeClick}
          overlay={
            (sharedModelError || projection.error) && (
              <div className="projection-error" role="alert">
                <strong>
                  {sharedModelError ? t("sharedModelUnavailable") : t("scopeUnavailable")}
                </strong>
                <p>{sharedModelError ?? projection.error}</p>
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
                errors={importErrors}
              />
              {sample.id.startsWith(IMPORTED_ID_PREFIX) && (
                <button type="button" className="secondary-action" onClick={handleDeleteImported}>
                  {t("deleteImportedModel")}
                </button>
              )}
              {importErrors.map((entry) => (
                <span key={entry.id} className="import-error-item" role="alert">
                  {t("loadErrorOption", { title: entry.title })}
                  <button
                    type="button"
                    onClick={() => handleDeleteImportError(entry.id)}
                    aria-label={t("deleteImportErrorAriaLabel", { title: entry.title })}
                  >
                    ×
                  </button>
                </span>
              ))}
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
              <button
                type="button"
                className="secondary-action"
                onClick={handleCopyShareLink}
                disabled={sharedModelPending}
              >
                {t("copyShareLink")}
              </button>
              {shareStatus?.kind === "copied" && (
                <span className="share-status share-status-ok">{t("shareCopied")}</span>
              )}
              {shareStatus?.kind === "error" && (
                <span className="share-status share-status-error" role="alert">
                  {shareStatus.message}
                </span>
              )}
              <ExportControl
                containerRef={canvasRef}
                processName={sample.title}
                boundaryLabel={boundaryLabelFor(zoomLevel, t)}
                disabled={Boolean(projection.error)}
              />
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
