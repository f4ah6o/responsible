import type { Node, NodeProps } from "@xyflow/react";

import type { ActivityNodeData } from "./projectionToFlow";

type ActivityNodeType = Node<ActivityNodeData, "activity">;

const KIND_LABELS: Record<string, string> = {
  atomic: "単体",
  composite: "合成",
};

export function ActivityNode({ data, selected }: NodeProps<ActivityNodeType>) {
  const { activity, names } = data;
  const title =
    activity.kind === "atomic"
      ? (names[0] ?? activity.id)
      : names.length <= 2
        ? names.join(" + ")
        : `${names[0]} → ${names[names.length - 1]}`;
  const subtitle =
    activity.kind === "composite" ? `${names.length} 件の Activity を合成` : activity.id;
  const kindLabel = KIND_LABELS[activity.kind] ?? activity.kind;

  return (
    <div className={`activity-card${selected ? " is-selected" : ""}`} data-kind={activity.kind}>
      <div className="activity-card-head">
        <span className="activity-kind">{kindLabel}</span>
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
