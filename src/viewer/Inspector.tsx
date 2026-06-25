import { HIERARCHICAL_BOUNDARY_ORDER, boundaryOf } from "../index.js";
import type { ActivityDef, Id, ProjectedActivity } from "../model.js";

export type InspectorProps = {
  activity: ProjectedActivity | undefined;
  activities: Readonly<Record<Id, ActivityDef>>;
  boundaryLabel: string;
};

const LEVELS: readonly string[] = [...HIERARCHICAL_BOUNDARY_ORDER];

const LEVEL_LABELS: Record<string, string> = {
  company: "会社",
  department: "部門",
  section: "課・セクション",
  team: "チーム",
  person: "担当者",
};

const KIND_LABELS: Record<string, string> = {
  atomic: "単体",
  composite: "合成",
};

const STATUS_LABELS: Record<string, string> = {
  discovered: "発見済み",
  defined: "定義済み",
  validated: "検証済み",
  automatable: "自動化可能",
  composite: "合成",
};

function sourceIdsOf(activity: ProjectedActivity): readonly Id[] {
  return activity.kind === "atomic" ? [activity.activityId] : activity.activityIds;
}

function unique(ids: readonly Id[]): Id[] {
  const seen = new Set<Id>();
  const result: Id[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function Inspector({ activity, activities, boundaryLabel }: InspectorProps) {
  if (!activity) {
    return (
      <aside className="inspector" aria-label="Activity 詳細">
        <div className="panel">
          <p className="empty-note">Activity ノードを選択すると詳細を表示します。</p>
        </div>
      </aside>
    );
  }

  const sourceIds = sourceIdsOf(activity);
  const sources = sourceIds
    .map((id) => activities[id])
    .filter((activityDef): activityDef is ActivityDef => activityDef !== undefined);
  const title =
    activity.kind === "atomic"
      ? (sources[0]?.name ?? activity.id)
      : sources.map((source) => source.name ?? source.id).join(" + ");
  const status = activity.kind === "atomic" ? (sources[0]?.status ?? "discovered") : "composite";
  const childIds = unique(sources.flatMap((source) => [...(source.children ?? [])]));
  const kindLabel = KIND_LABELS[activity.kind] ?? activity.kind;
  const statusLabel = STATUS_LABELS[status] ?? status;

  return (
    <aside className="inspector" aria-label="Activity 詳細">
      <div className="panel">
        <p className="eyebrow">選択中の Activity</p>
        <h2>{title}</h2>
        <dl className="facts">
          <div>
            <dt>種類</dt>
            <dd>{kindLabel}</dd>
          </div>
          <div>
            <dt>入力</dt>
            <dd>{activity.input}</dd>
          </div>
          <div>
            <dt>出力</dt>
            <dd>{activity.output}</dd>
          </div>
          <div>
            <dt>状態</dt>
            <dd>{statusLabel}</dd>
          </div>
          <div>
            <dt>{boundaryLabel}</dt>
            <dd>{activity.boundary}</dd>
          </div>
        </dl>

        {activity.kind === "composite" ? (
          <>
            <h3>合成された Activity</h3>
            <ol className="activity-id-list">
              {sourceIds.map((id) => (
                <li key={id}>{activities[id]?.name ?? id}</li>
              ))}
            </ol>
          </>
        ) : null}

        <h3>責任境界</h3>
        <table className="responsibility-table">
          <thead>
            <tr>
              <th>Activity</th>
              {LEVELS.map((level) => (
                <th key={level}>{LEVEL_LABELS[level] ?? level}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <th>{source.name ?? source.id}</th>
                {LEVELS.map((level) => (
                  <td key={level}>{boundaryOf(source, level)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <h3>子 Activity</h3>
        <div className="child-list">
          {childIds.length > 0 ? (
            childIds.map((id) => (
              <span key={id} className="child-pill read-only">
                {activities[id]?.name ?? id}
              </span>
            ))
          ) : (
            <span className="empty-note">子 Activity はありません。</span>
          )}
        </div>
      </div>
    </aside>
  );
}
