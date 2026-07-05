import { useLayoutEffect, useRef } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import type { ActivityNodeData } from "./projectionToFlow";
import { useHeightReporter } from "./HeightReportContext";

type ActivityNodeType = Node<ActivityNodeData, "activity">;

const KIND_LABELS: Record<string, string> = {
  atomic: "単体",
  composite: "合成",
};

export function ActivityNode({ data, selected }: NodeProps<ActivityNodeType>) {
  const { activity, names } = data;
  const title = activity.kind === "atomic" ? (names[0] ?? activity.id) : names.join(" + ");
  const subtitle =
    activity.kind === "composite" ? `${names.length} 件の Activity を合成` : activity.id;
  const kindLabel = KIND_LABELS[activity.kind] ?? activity.kind;

  const ref = useRef<HTMLDivElement>(null);
  const report = useHeightReporter();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      report(activity.id, el.offsetHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activity.id, report]);

  // boundary may be a full path "company:X|department:Y|team:Z" — show only leaf value
  const boundaryLabel = (() => {
    const parts = activity.boundary.split("|");
    const last = parts[parts.length - 1] ?? activity.boundary;
    const idx = last.indexOf(":");
    return idx >= 0 ? last.slice(idx + 1) : last;
  })();

  return (
    <div
      ref={ref}
      className={`activity-card${selected ? " is-selected" : ""}`}
      data-kind={activity.kind}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <Handle type="source" position={Position.Right} isConnectable={false} />
      <div className="activity-card-head">
        <span className="activity-kind">{kindLabel}</span>
        <strong className="activity-title">{title}</strong>
      </div>
      <div className="activity-subtitle">{subtitle}</div>
      <div className="activity-type">
        {activity.input} → {activity.output}
      </div>
      <div className="activity-boundary">{boundaryLabel}</div>
    </div>
  );
}
