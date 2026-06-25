import { HIERARCHICAL_BOUNDARY_ORDER, boundaryOf } from "../index.js";
import type { ActivityDef, Id, ProjectedActivity } from "../model.js";

export type InspectorProps = {
  activity: ProjectedActivity | undefined;
  activities: Readonly<Record<Id, ActivityDef>>;
  boundaryKey: string;
};

const LEVELS: readonly string[] = [...HIERARCHICAL_BOUNDARY_ORDER];

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

export function Inspector({ activity, activities, boundaryKey }: InspectorProps) {
  if (!activity) {
    return (
      <aside className="inspector" aria-label="Activity inspector">
        <div className="panel">
          <p className="empty-note">Select an Activity node to inspect it.</p>
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

  return (
    <aside className="inspector" aria-label="Activity inspector">
      <div className="panel">
        <p className="eyebrow">selected activity</p>
        <h2>{title}</h2>
        <dl className="facts">
          <div>
            <dt>Kind</dt>
            <dd>{activity.kind}</dd>
          </div>
          <div>
            <dt>Input</dt>
            <dd>{activity.input}</dd>
          </div>
          <div>
            <dt>Output</dt>
            <dd>{activity.output}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{status}</dd>
          </div>
          <div>
            <dt>{boundaryKey}</dt>
            <dd>{activity.boundary}</dd>
          </div>
        </dl>

        {activity.kind === "composite" ? (
          <>
            <h3>Composed activities</h3>
            <ol className="activity-id-list">
              {sourceIds.map((id) => (
                <li key={id}>{activities[id]?.name ?? id}</li>
              ))}
            </ol>
          </>
        ) : null}

        <h3>Responsibility</h3>
        <table className="responsibility-table">
          <thead>
            <tr>
              <th>Activity</th>
              {LEVELS.map((level) => (
                <th key={level}>{level}</th>
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

        <h3>Children</h3>
        <div className="child-list">
          {childIds.length > 0 ? (
            childIds.map((id) => (
              <span key={id} className="child-pill read-only">
                {activities[id]?.name ?? id}
              </span>
            ))
          ) : (
            <span className="empty-note">No child Activity.</span>
          )}
        </div>
      </div>
    </aside>
  );
}
