import "./styles.css";
import { boundaryOf, formatBoundaryValue, projectByResponsibilityBoundary, isResponsibilityBoundaryNormalForm } from "./index.js";
import type { ActivityDef, BoundaryExpr, BoundaryValue, Id, ProcessView, ProjectedActivity, ViewDef } from "./model.js";
import { sampleModel } from "./sample.js";

type Screen = "activities" | "boundaries";

type AppState = {
  screen: Screen;
  boundary: BoundaryExpr;
  selectedActivityId: Id;
};

const rootElement = document.querySelector<HTMLDivElement>("#app");
if (!rootElement) throw new Error("#app is required");
const root = rootElement;

const boundaryOptions: BoundaryExpr[] = ["person", "team", "section", "department", "company", "function", "role", "system", ["project", "function"]];
const state: AppState = {
  screen: "activities",
  boundary: "department",
  selectedActivityId: "receive_inquiry",
};

function render(): void {
  const ordered = orderActivities();
  const selectedActivity = sampleModel.activities[state.selectedActivityId] ?? ordered[0];

  root.innerHTML = `
    <main class="shell">
      <header class="hero">
        <div>
          <p class="eyebrow">responsible reference implementation</p>
          <h1>Activity と責任境界で業務を可視化する</h1>
          <p class="lead">内部モデルは Activity の合成として保ち、View 側で責任境界を選んで射影する。連続する同一境界の Activity は表示上 1 つの合成 Activity になる。</p>
        </div>
        <div class="summary-card" aria-label="model summary">
          <span>${ordered.length}</span><small>activities</small>
          <span>${sampleModel.flows.length}</span><small>flows</small>
        </div>
      </header>
      <nav class="toolbar" aria-label="views">
        <div class="tabs" role="tablist" aria-label="screens">
          ${tabButton("activities", "Activity view")}
          ${tabButton("boundaries", "Responsibility boundary view")}
        </div>
        <label class="boundary-picker">
          <span>Boundary</span>
          <select id="boundary-select">
            ${boundaryOptions.map((boundary) => option(boundary)).join("")}
          </select>
        </label>
      </nav>
      ${state.screen === "activities" ? renderActivityScreen(ordered, selectedActivity) : renderBoundaryScreen()}
    </main>`;

  bindEvents();
}

function tabButton(screen: Screen, label: string): string {
  const selected = state.screen === screen;
  return `<button class="tab ${selected ? "is-selected" : ""}" data-screen="${screen}" role="tab" aria-selected="${selected}">${label}</button>`;
}

function option(boundary: BoundaryExpr): string {
  const label = boundaryLabel(boundary);
  return `<option value="${escapeHtml(label)}" ${label === boundaryLabel(state.boundary) ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderActivityScreen(ordered: ActivityDef[], selectedActivity: ActivityDef | undefined): string {
  return `
    <section class="screen activity-screen" aria-label="Activity view">
      <div class="activity-rail" aria-label="Activity sequence">
        ${ordered.map((activity, index) => renderActivityCard(activity, index + 1)).join("")}
      </div>
      <aside class="inspector" aria-label="Activity inspector">
        ${selectedActivity ? renderActivityInspector(selectedActivity) : ""}
      </aside>
    </section>`;
}

function renderActivityCard(activity: ActivityDef, index: number): string {
  const selected = activity.id === state.selectedActivityId;
  return `
    <button class="activity-card ${selected ? "is-selected" : ""}" data-activity-id="${activity.id}">
      <span class="step">${index}</span>
      <span class="activity-main"><strong>${escapeHtml(activity.name ?? activity.id)}</strong><small>${escapeHtml(activity.id)}</small></span>
      <span class="type-flow">${escapeHtml(activity.input)} → ${escapeHtml(activity.output)}</span>
      <span class="boundary-chip">${escapeHtml(boundaryOf(activity, state.boundary))}</span>
    </button>`;
}

function renderActivityInspector(activity: ActivityDef): string {
  const rows = Object.entries(activity.responsibility ?? {})
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(formatBoundaryValue(value as BoundaryValue))}</td></tr>`)
    .join("");
  const contracts = sampleModel.flows.filter((flow) => flow.from === activity.id || flow.to === activity.id);

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
      <h3>Responsibility</h3>
      <table class="responsibility-table"><tbody>${rows}</tbody></table>
      <h3>Flow contracts</h3>
      <div class="contract-list">
        ${contracts.map((flow) => `<div class="contract"><strong>${escapeHtml(flow.from)} → ${escapeHtml(flow.to)}</strong><span>${escapeHtml(flow.contract ?? "contract is not defined yet")}</span></div>`).join("")}
      </div>
    </div>`;
}

function renderBoundaryScreen(): string {
  const view: ViewDef = { id: "current", layout: "lane", boundary: state.boundary, normalForm: "responsibilityBoundary" };
  const projected = projectByResponsibilityBoundary(sampleModel, view);
  const lanes = groupByBoundary(projected);
  const collapsedCount = orderActivities().length - projected.activities.length;

  return `
    <section class="screen boundary-screen" aria-label="Responsibility boundary view">
      <div class="projection-header">
        <div><p class="eyebrow">projection</p><h2>${escapeHtml(boundaryLabel(state.boundary))} boundary</h2></div>
        <div class="projection-stats">
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

function renderLane(boundary: string, nodes: ProjectedActivity[]): string {
  return `
    <section class="lane" aria-label="${escapeHtml(boundary)} lane">
      <header>${escapeHtml(boundary)}</header>
      <div class="lane-track">${nodes.map(renderProjectedNode).join("")}</div>
    </section>`;
}

function renderProjectedNode(node: ProjectedActivity): string {
  const activityIds = node.kind === "atomic" ? [node.activityId] : [...node.activityIds];
  const title = node.kind === "atomic" ? sampleModel.activities[node.activityId]?.name ?? node.activityId : `${activityIds.length} activities`;
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

function orderActivities(): ActivityDef[] {
  const byFrom = new Map(sampleModel.flows.map((flow) => [flow.from, flow.to]));
  const targets = new Set(sampleModel.flows.map((flow) => flow.to));
  const start = Object.keys(sampleModel.activities).find((id) => !targets.has(id));
  const ordered: ActivityDef[] = [];
  let current = start;

  while (current) {
    const activity = sampleModel.activities[current];
    if (!activity) break;
    ordered.push(activity);
    current = byFrom.get(current);
  }

  return ordered;
}

function bindEvents(): void {
  for (const tab of root.querySelectorAll<HTMLButtonElement>("[data-screen]")) {
    tab.addEventListener("click", () => setState({ screen: tab.dataset.screen === "boundaries" ? "boundaries" : "activities" }));
  }

  for (const card of root.querySelectorAll<HTMLButtonElement>("[data-activity-id]")) {
    card.addEventListener("click", () => {
      const selectedActivityId = card.dataset.activityId;
      if (selectedActivityId) setState({ selectedActivityId });
    });
  }

  root.querySelector<HTMLSelectElement>("#boundary-select")?.addEventListener("change", (event) => {
    const label = (event.currentTarget as HTMLSelectElement).value;
    setState({ boundary: boundaryOptions.find((boundary) => boundaryLabel(boundary) === label) ?? "department" });
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
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

render();
