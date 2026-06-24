import "./styles.css";
import {
  boundaryOf,
  formatBoundaryValue,
  isResponsibilityBoundaryNormalForm,
  projectByResponsibilityBoundary,
} from "./index.js";
import {
  HIERARCHICAL_BOUNDARY_ORDER,
  boundaryForLevel,
  canZoomIn,
  canZoomOut,
} from "./hierarchy.js";
import {
  layoutActivityTreeGraph,
  layoutProjectedGraph,
  type GraphLayout,
  type GraphNode,
} from "./graph.js";
import type {
  ActivityDef,
  BoundaryExpr,
  BoundaryValue,
  FlowDef,
  Id,
  ProcessModel,
  ProcessView,
  ProjectedActivity,
  ViewDef,
} from "./model.js";
import { rootActivityId, sampleModel } from "./sample.js";

type Screen = "activities" | "boundaries" | "graph";

type AppState = {
  screen: Screen;
  boundary: BoundaryExpr;
  zoomLevel: number | null;
  drillActivityId: Id;
  selectedActivityId: Id;
};

const rootElement = document.querySelector<HTMLDivElement>("#app");
if (!rootElement) throw new Error("#app is required");
const root = rootElement;

const displayAxisOptions: BoundaryExpr[] = ["function", "role", "system", ["project", "function"]];

const DEFAULT_ZOOM_LEVEL = 1;

const state: AppState = {
  screen: "graph",
  boundary: HIERARCHICAL_BOUNDARY_ORDER[DEFAULT_ZOOM_LEVEL]!,
  zoomLevel: DEFAULT_ZOOM_LEVEL,
  drillActivityId: rootActivityId,
  selectedActivityId: "receive_order",
};

function render(): void {
  const leafCount = leafIdsUnder(rootActivityId).length;
  const projected = projectCurrent();
  const zoom = currentZoomDescriptor();
  const drillActivity = sampleModel.activities[state.drillActivityId];

  root.innerHTML = `
    <main class="shell">
      <header class="hero">
        <div>
          <p class="eyebrow">responsible reference implementation</p>
          <h1>Activity と責任境界で業務を可視化する</h1>
          <p class="lead">同じ Activity Graph と同じ表示対象プロセスに対して、責任境界レベルを切り替えることがズームである。Activity は変えず、boundary レベルを上下させる。</p>
        </div>
        <div class="summary-card" aria-label="model summary">
          <span>${leafCount}</span><small>leaf activities</small>
          <span>${projected.activities.length}</span><small>projected nodes</small>
        </div>
      </header>
      <nav class="toolbar" aria-label="views">
        <div class="tabs" role="tablist" aria-label="screens">
          ${tabButton("graph", "Graph nodes")}
          ${tabButton("activities", "Activity decomposition")}
          ${tabButton("boundaries", "Boundary lanes")}
        </div>
        <label class="boundary-picker">
          <span>Display axis</span>
          <select id="display-axis-select">
            <option value="__hierarchical__" ${zoom.isHierarchical ? "selected" : ""}>boundary zoom</option>
            ${displayAxisOptions.map((axis) => option(axis, state.boundary)).join("")}
          </select>
        </label>
      </nav>
      <section class="zoom-bar" aria-label="Responsibility boundary zoom">
        <button class="secondary-action" id="zoom-out" ${zoom.canZoomOut ? "" : "disabled"}>Zoom out</button>
        <div class="zoom-scope">
          <span>boundary zoom</span>
          <strong>${escapeHtml(zoom.label)}</strong>
          <small>${escapeHtml(zoom.rangeLabel)}</small>
        </div>
        <button class="primary-action" id="zoom-in" ${zoom.canZoomIn ? "" : "disabled"}>Zoom in</button>
      </section>
      <section class="zoom-bar" aria-label="Activity decomposition scope">
        <div class="breadcrumbs">${renderDrillBreadcrumbs()}</div>
        <div class="zoom-scope"><span>decomposition scope</span><strong>${escapeHtml(drillActivity?.name ?? state.drillActivityId)}</strong></div>
      </section>
      ${renderCurrentScreen()}
    </main>`;

  bindEvents();
}

type ZoomDescriptor = {
  label: string;
  rangeLabel: string;
  isHierarchical: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
};

function currentZoomDescriptor(): ZoomDescriptor {
  if (state.zoomLevel === null) {
    return {
      label: boundaryLabel(state.boundary),
      rangeLabel: "display axis (not a hierarchical zoom level)",
      isHierarchical: false,
      canZoomIn: false,
      canZoomOut: false,
    };
  }

  const level = state.zoomLevel;
  const ordinal = level + 1;
  const total = HIERARCHICAL_BOUNDARY_ORDER.length;
  return {
    label: HIERARCHICAL_BOUNDARY_ORDER[level]!,
    rangeLabel: `level ${ordinal}/${total}`,
    isHierarchical: true,
    canZoomIn: canZoomIn(level),
    canZoomOut: canZoomOut(level),
  };
}

function renderCurrentScreen(): string {
  if (state.screen === "graph") return renderGraphScreen();
  if (state.screen === "boundaries") return renderBoundaryScreen();
  return renderActivityScreen();
}

function tabButton(screen: Screen, label: string): string {
  const selected = state.screen === screen;
  return `<button class="tab ${selected ? "is-selected" : ""}" data-screen="${screen}" role="tab" aria-selected="${selected}">${escapeHtml(label)}</button>`;
}

function option(boundary: BoundaryExpr, current: BoundaryExpr): string {
  const label = boundaryLabel(boundary);
  return `<option value="${escapeHtml(label)}" ${label === boundaryLabel(current) ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderDrillBreadcrumbs(): string {
  const path = pathToActivity(rootActivityId, state.drillActivityId) ?? [rootActivityId];
  return path
    .map((id, index) => {
      const activity = sampleModel.activities[id];
      const current = id === state.drillActivityId;
      const separator = index === 0 ? "" : `<span class="breadcrumb-separator">/</span>`;
      return `${separator}<button class="breadcrumb ${current ? "is-current" : ""}" data-drill-id="${id}">${escapeHtml(activity?.name ?? id)}</button>`;
    })
    .join("");
}

function renderActivityScreen(): string {
  const activities = drillChildren();
  const selectedActivity =
    sampleModel.activities[state.selectedActivityId] ?? activities[0];

  return `
    <section class="screen activity-screen" aria-label="Activity decomposition view">
      <div class="activity-rail" aria-label="Activity sequence">
        ${activities.map((activity, index) => renderActivityCard(activity, index + 1)).join("")}
      </div>
      <aside class="inspector" aria-label="Activity inspector">
        ${selectedActivity ? renderActivityInspector(selectedActivity) : ""}
      </aside>
    </section>`;
}

function renderActivityCard(activity: ActivityDef, index: number): string {
  const selected = activity.id === state.selectedActivityId;
  const children = activityChildren(activity.id);
  return `
    <button class="activity-card ${selected ? "is-selected" : ""}" data-activity-id="${activity.id}">
      <span class="step">${index}</span>
      <span class="activity-main"><strong>${escapeHtml(activity.name ?? activity.id)}</strong><small>${escapeHtml(activity.id)}</small></span>
      <span class="type-flow">${escapeHtml(activity.input)} → ${escapeHtml(activity.output)}</span>
      <span class="card-chips">
        <span class="boundary-chip">${escapeHtml(boundaryOf(activity, state.boundary))}</span>
        ${children.length > 0 ? `<span class="zoom-chip">${children.length} children</span>` : `<span class="zoom-chip">leaf</span>`}
      </span>
    </button>`;
}

function renderActivityInspector(activity: ActivityDef): string {
  const rows = Object.entries(activity.responsibility ?? {})
    .map(
      ([key, value]) =>
        `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(formatBoundaryValue(value as BoundaryValue))}</td></tr>`,
    )
    .join("");
  const children = activityChildren(activity.id);
  const leaves = leafIdsUnder(activity.id);
  const leafSet = new Set(leaves);
  const contracts = sampleModel.flows.filter(
    (flow) => leafSet.has(flow.from) || leafSet.has(flow.to),
  );

  return `
    <div class="panel">
      <p class="eyebrow">selected activity</p>
      <h2>${escapeHtml(activity.name ?? activity.id)}</h2>
      <dl class="facts">
        <div><dt>Input</dt><dd>${escapeHtml(activity.input)}</dd></div>
        <div><dt>Output</dt><dd>${escapeHtml(activity.output)}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(activity.status ?? "discovered")}</dd></div>
        <div><dt>${escapeHtml(boundaryLabel(state.boundary))}</dt><dd>${escapeHtml(boundaryOf(activity, state.boundary))}</dd></div>
      </dl>
      <div class="zoom-actions">
        ${children.length > 0 ? `<button class="primary-action" data-drill-in-id="${activity.id}">Drill into this Activity</button>` : `<span class="leaf-note">Leaf Activity: this is the current executable detail.</span>`}
        ${state.drillActivityId !== rootActivityId ? `<button class="secondary-action" data-drill-out="true">Drill out</button>` : ""}
      </div>
      <h3>Children</h3>
      <div class="child-list">
        ${children.length > 0 ? children.map((child) => `<button class="child-pill" data-activity-id="${child.id}">${escapeHtml(child.name ?? child.id)}</button>`).join("") : `<span class="empty-note">No child Activity.</span>`}
      </div>
      <h3>Responsibility</h3>
      <table class="responsibility-table"><tbody>${rows}</tbody></table>
      <h3>Flow contracts in scope</h3>
      <div class="contract-list">
        ${contracts.map((flow) => `<div class="contract"><strong>${escapeHtml(flow.from)} → ${escapeHtml(flow.to)}</strong><span>${escapeHtml(flow.contract ?? "contract is not defined yet")}</span></div>`).join("")}
      </div>
    </div>`;
}

function renderBoundaryScreen(): string {
  const view = currentView();
  const scoped = scopedProcessModel(scopeLeafIds());
  const projected = projectByResponsibilityBoundary(scoped, view);
  const lanes = groupByBoundary(projected);
  const collapsedCount = Object.keys(scoped.activities).length - projected.activities.length;

  return `
    <section class="screen boundary-screen" aria-label="Responsibility boundary view">
      <div class="projection-header">
        <div><p class="eyebrow">projection of the displayed process</p><h2>Process × ${escapeHtml(boundaryLabel(state.boundary))}</h2></div>
        <div class="projection-stats">
          <span><strong>${Object.keys(scoped.activities).length}</strong> leaf activities</span>
          <span><strong>${projected.activities.length}</strong> projected nodes</span>
          <span><strong>${collapsedCount}</strong> collapsed same-boundary steps</span>
          <span><strong>${isResponsibilityBoundaryNormalForm(projected) ? "yes" : "no"}</strong> normal form</span>
        </div>
      </div>
      <div class="lane-board">
        ${lanes.map(([boundary, nodes]) => renderLane(boundary, nodes)).join("")}
      </div>
    </section>`;
}

function renderGraphScreen(): string {
  const scoped = scopedProcessModel(scopeLeafIds());
  const projected = projectByResponsibilityBoundary(scoped, currentView());
  const activityGraph = layoutActivityTreeGraph(
    sampleModel,
    rootActivityId,
    state.drillActivityId,
    state.selectedActivityId,
  );
  const projectionGraph = layoutProjectedGraph(
    projected,
    sampleModel.activities,
    resolveSelectedLeaf() ?? state.selectedActivityId,
  );

  return `
    <section class="screen graph-screen" aria-label="Graph node view">
      <article class="graph-panel">
        <div class="projection-header">
          <div><p class="eyebrow">activity decomposition graph</p><h2>Activity tree</h2></div>
          <div class="projection-stats">
            <span><strong>${activityGraph.nodes.length}</strong> nodes</span>
            <span><strong>${activityGraph.edges.length}</strong> edges</span>
          </div>
        </div>
        <p class="lead">Activity ツリーの移動は Drill-down（分解）。責任境界ズームとは別操作。</p>
        ${renderSvgGraph(activityGraph, "activity-tree")}
      </article>
      <article class="graph-panel">
        <div class="projection-header">
          <div><p class="eyebrow">boundary projection graph</p><h2>Process × ${escapeHtml(boundaryLabel(state.boundary))}</h2></div>
          <div class="projection-stats">
            <span><strong>${projectionGraph.lanes.length}</strong> lanes</span>
            <span><strong>${projectionGraph.nodes.length}</strong> projected nodes</span>
            <span><strong>${projectionGraph.edges.length}</strong> projected edges</span>
            <span><strong>${isResponsibilityBoundaryNormalForm(projected) ? "yes" : "no"}</strong> normal form</span>
          </div>
        </div>
        <p class="lead">Zoom で Activity Graph のスコープは変わらず、責任境界レベルだけ切り替わる。</p>
        ${renderSvgGraph(projectionGraph, "projection-graph")}
      </article>
    </section>`;
}

function renderSvgGraph(layout: GraphLayout, label: string): string {
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  const lanes = layout.lanes
    .map(
      (lane) =>
        `<g class="graph-lane"><rect x="${lane.x}" y="${lane.y}" width="${lane.width}" height="${lane.height}" rx="22" /><text x="${lane.x + 18}" y="${lane.y + 28}">${escapeHtml(lane.label)}</text></g>`,
    )
    .join("");
  const edges = layout.edges
    .map((edge) => {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) return "";
      const points = edgePoints(from, to);
      return `<line class="graph-edge" x1="${points.x1}" y1="${points.y1}" x2="${points.x2}" y2="${points.y2}" marker-end="url(#${label}-arrow)" />`;
    })
    .join("");

  return `
    <div class="graph-scroll">
      <svg class="node-graph" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" role="img" aria-label="${escapeHtml(label)}">
        <defs>
          <marker id="${label}-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" class="graph-arrow" />
          </marker>
        </defs>
        ${lanes}
        ${edges}
        ${layout.nodes.map(renderGraphNode).join("")}
      </svg>
    </div>`;
}

function renderGraphNode(node: GraphNode): string {
  const classes = [
    "graph-node",
    `is-${node.kind}`,
    node.selected ? "is-selected" : "",
    node.focusable ? "is-focusable" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const attrs = node.focusable
    ? `data-graph-drill-id="${node.id}"`
    : node.activityId
      ? `data-activity-id="${node.activityId}"`
      : "";
  const titleLines = splitLabel(node.label, 16);
  const detail = truncate(node.detail, 36);

  return `
    <g class="${classes}" transform="translate(${node.x - 104} ${node.y - 46})" ${attrs} tabindex="0">
      <rect width="208" height="92" rx="18" />
      ${titleLines.map((line, index) => `<text class="graph-title" x="104" y="${30 + index * 16}" text-anchor="middle">${escapeHtml(line)}</text>`).join("")}
      <text class="graph-detail" x="104" y="74" text-anchor="middle">${escapeHtml(detail)}</text>
    </g>`;
}

function edgePoints(
  from: GraphNode,
  to: GraphNode,
): { x1: number; y1: number; x2: number; y2: number } {
  const horizontal = Math.abs(from.y - to.y) < 24;
  if (horizontal) {
    const direction = to.x >= from.x ? 1 : -1;
    return { x1: from.x + direction * 108, y1: from.y, x2: to.x - direction * 108, y2: to.y };
  }

  const direction = to.y >= from.y ? 1 : -1;
  return { x1: from.x, y1: from.y + direction * 50, x2: to.x, y2: to.y - direction * 50 };
}

function splitLabel(label: string, size: number): string[] {
  if (label.length <= size) return [label];
  return [label.slice(0, size), truncate(label.slice(size), size)];
}

function truncate(value: string, size: number): string {
  return value.length <= size ? value : `${value.slice(0, Math.max(0, size - 1))}…`;
}

function renderLane(boundary: string, nodes: ProjectedActivity[]): string {
  return `
    <section class="lane" aria-label="${escapeHtml(boundary)} lane">
      <header>${escapeHtml(boundary)}</header>
      <div class="lane-track">${nodes.map(renderProjectedNode).join("")}</div>
    </section>`;
}

function renderProjectedNode(node: ProjectedActivity): string {
  const activityIds = node.kind === "atomic" ? [node.activityId] : [...node.activityIds];
  const title =
    node.kind === "atomic"
      ? (sampleModel.activities[node.activityId]?.name ?? node.activityId)
      : `${activityIds.length} activities`;
  return `
    <article class="projection-node">
      <div class="node-header"><span>${escapeHtml(node.kind)}</span><strong>${escapeHtml(title)}</strong></div>
      <p class="type-flow">${escapeHtml(node.input)} → ${escapeHtml(node.output)}</p>
      <ol>${activityIds.map((id) => `<li><button data-activity-id="${id}" class="inline-activity">${escapeHtml(sampleModel.activities[id]?.name ?? id)}</button></li>`).join("")}</ol>
    </article>`;
}

function groupByBoundary(view: ProcessView): [string, ProjectedActivity[]][] {
  const order: string[] = [];
  const groups = new Map<string, ProjectedActivity[]>();

  for (const activity of view.activities) {
    if (!groups.has(activity.boundary)) {
      groups.set(activity.boundary, []);
      order.push(activity.boundary);
    }
    groups.get(activity.boundary)?.push(activity);
  }

  return order.map((boundary) => [boundary, groups.get(boundary) ?? []]);
}

function drillChildren(): ActivityDef[] {
  const children = activityChildren(state.drillActivityId);
  if (children.length > 0) return children;
  const focus = sampleModel.activities[state.drillActivityId];
  return focus ? [focus] : [];
}

function activityChildren(id: Id): ActivityDef[] {
  const childIds = sampleModel.activities[id]?.children ?? [];
  return childIds.flatMap((childId) => {
    const child = sampleModel.activities[childId];
    return child ? [child] : [];
  });
}

function leafIdsUnder(id: Id, seen = new Set<Id>()): Id[] {
  if (seen.has(id)) return [];
  seen.add(id);

  const activity = sampleModel.activities[id];
  if (!activity) return [];
  const children = activity.children ?? [];
  if (children.length === 0) return [id];
  return children.flatMap((childId) => leafIdsUnder(childId, seen));
}

function pathToActivity(current: Id, target: Id, path: Id[] = []): Id[] | undefined {
  const nextPath = [...path, current];
  if (current === target) return nextPath;

  const children = sampleModel.activities[current]?.children ?? [];
  for (const childId of children) {
    const found = pathToActivity(childId, target, nextPath);
    if (found) return found;
  }

  return undefined;
}

function parentOf(id: Id): Id | undefined {
  for (const [candidateId, activity] of Object.entries(sampleModel.activities)) {
    if (activity.children?.includes(id)) return candidateId;
  }
  return undefined;
}

function scopeLeafIds(): Id[] {
  return leafIdsUnder(rootActivityId);
}

function scopedProcessModel(leafIds: readonly Id[]): ProcessModel {
  const include = new Set(leafIds);
  const activities: Record<Id, ActivityDef> = {};
  const flows: FlowDef[] = [];

  for (const id of leafIds) {
    const activity = sampleModel.activities[id];
    if (activity) activities[id] = activity;
  }

  for (const flow of sampleModel.flows) {
    if (include.has(flow.from) && include.has(flow.to)) flows.push(flow);
  }

  return {
    schemaVersion: sampleModel.schemaVersion,
    activities,
    flows,
  };
}

function currentView(): ViewDef {
  return {
    id: "current",
    layout: "lane",
    boundary: state.boundary,
    normalForm: "responsibilityBoundary",
  };
}

function projectCurrent(): ProcessView {
  const scoped = scopedProcessModel(scopeLeafIds());
  return projectByResponsibilityBoundary(scoped, currentView());
}

function resolveSelectedLeaf(): Id | undefined {
  const activity = sampleModel.activities[state.selectedActivityId];
  if (!activity) return undefined;
  if (!activity.children || activity.children.length === 0) return activity.id;
  const leaves = leafIdsUnder(activity.id);
  return leaves[0];
}

function bindEvents(): void {
  for (const tab of root.querySelectorAll("[data-screen]")) {
    tab.addEventListener("click", () =>
      setState({ screen: screenFromValue(tab.getAttribute("data-screen")) }),
    );
  }

  for (const crumb of root.querySelectorAll("[data-drill-id]")) {
    crumb.addEventListener("click", () => {
      const drillActivityId = crumb.getAttribute("data-drill-id");
      if (drillActivityId) setDrill(drillActivityId);
    });
  }

  for (const graphNode of root.querySelectorAll("[data-graph-drill-id]")) {
    graphNode.addEventListener("click", () => {
      const drillActivityId = graphNode.getAttribute("data-graph-drill-id");
      if (drillActivityId) setDrill(drillActivityId);
    });
  }

  for (const card of root.querySelectorAll("[data-activity-id]")) {
    card.addEventListener("click", () => {
      const selectedActivityId = card.getAttribute("data-activity-id");
      if (selectedActivityId) setState({ selectedActivityId, screen: "activities" });
    });
  }

  for (const button of root.querySelectorAll("[data-drill-in-id]")) {
    button.addEventListener("click", () => {
      const drillActivityId = button.getAttribute("data-drill-in-id");
      if (drillActivityId) setDrill(drillActivityId);
    });
  }

  root.querySelector("[data-drill-out]")?.addEventListener("click", () => {
    const parent = parentOf(state.drillActivityId);
    if (parent) setDrill(parent, state.drillActivityId);
  });

  root.querySelector("#zoom-in")?.addEventListener("click", () => {
    zoomBoundary(1);
  });

  root.querySelector("#zoom-out")?.addEventListener("click", () => {
    zoomBoundary(-1);
  });

  root
    .querySelector<HTMLSelectElement>("#display-axis-select")
    ?.addEventListener("change", (event) => {
      const value = (event.currentTarget as HTMLSelectElement).value;
      if (value === "__hierarchical__") {
        setState({
          boundary: boundaryForLevel(state.zoomLevel ?? DEFAULT_ZOOM_LEVEL),
          zoomLevel: state.zoomLevel ?? DEFAULT_ZOOM_LEVEL,
        });
        return;
      }
      const axis =
        displayAxisOptions.find((boundary) => boundaryLabel(boundary) === value) ?? "function";
      setState({ boundary: axis, zoomLevel: null });
    });
}

function zoomBoundary(direction: 1 | -1): void {
  if (state.zoomLevel === null) return;
  const next = state.zoomLevel + (direction === 1 ? 1 : -1);
  setState({
    zoomLevel: next,
    boundary: boundaryForLevel(next),
  });
}

function screenFromValue(value: string | null): Screen {
  if (value === "boundaries" || value === "graph") return value;
  return "activities";
}

function setDrill(drillActivityId: Id, selectedActivityId?: Id): void {
  const children = activityChildren(drillActivityId);
  setState({
    drillActivityId,
    selectedActivityId: selectedActivityId ?? children[0]?.id ?? drillActivityId,
  });
}

function setState(next: Partial<AppState>): void {
  Object.assign(state, next);
  render();
}

function boundaryLabel(boundary: BoundaryExpr): string {
  return typeof boundary === "string" ? boundary : boundary.join(" + ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
