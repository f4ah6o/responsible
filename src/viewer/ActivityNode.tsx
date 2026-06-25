import type { Node, NodeProps } from "@xyflow/react";

import type { ActivityNodeData } from "./projectionToFlow";

type ActivityNodeType = Node<ActivityNodeData, "activity">;

export function ActivityNode({ data, selected }: NodeProps<ActivityNodeType>) {
  const { activity, names } = data;
  const title = activity.kind === "atomic" ? (names[0] ?? activity.id) : names.join(" + ");
  const subtitle = activity.kind === "composite" ? `${names.length} activities` : activity.id;

  return (
    <div className={`activity-card${selected ? " is-selected" : ""}`} data-kind={activity.kind}>
      <div className="activity-card-head">
        <span className="activity-kind">{activity.kind}</span>
        <strong className="activity-title">{title}</strong>
      </div>
      <div className="activity-subtitle">{subtitle}</div>
      <div className="activity-type">
        {activity.input} → {activity.output}
      </div>
      <div className="activity-boundary">{activity.boundary}</div>
    </div>
  );
}
