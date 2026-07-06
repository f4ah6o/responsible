import { useLayoutEffect, useRef, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import type { ActivityNodeData, MemberInfo } from "./projectionToFlow";
import { useSizeReporter } from "./SizeReportContext";

type ActivityNodeType = Node<ActivityNodeData, "activity">;

const KIND_LABELS: Record<string, string> = {
  atomic: "単体",
  composite: "合成",
};

const BASE_CARD_WIDTH = 180;
const MEMBER_COLUMN_WIDTH = 150;
const MEMBER_GAP = 6;
const CARD_PADDING_X = 26; // horizontal padding + border of .activity-card

// How many member columns fit in the horizontal room the layout granted.
function memberColumns(memberCount: number, maxWidth: number): number {
  const usable = maxWidth - CARD_PADDING_X;
  const fit = Math.floor((usable + MEMBER_GAP) / (MEMBER_COLUMN_WIDTH + MEMBER_GAP));
  return Math.min(memberCount, Math.max(1, fit));
}

function cardWidthFor(columns: number): number {
  return Math.max(
    BASE_CARD_WIDTH,
    CARD_PADDING_X + columns * MEMBER_COLUMN_WIDTH + (columns - 1) * MEMBER_GAP,
  );
}

function EffectBadges({ effects }: { effects: ActivityNodeData["effects"] }) {
  if (effects.length === 0) return null;
  return (
    <ul className="activity-effects" aria-label="観測可能な Effect">
      {effects.map((effect, index) => (
        <li
          key={`${effect.source.activityId}:${index}`}
          className="effect-badge"
          data-mode={effect.delivery.mode}
        >
          {effect.payload.schema}
          {effect.delivery.mode === "directed"
            ? ` → ${leafBoundaryLabel(effect.delivery.target)}`
            : ` (${effect.delivery.mode})`}
        </li>
      ))}
    </ul>
  );
}

function MemberRow({ member }: { member: MemberInfo }) {
  return (
    <li className="member-row">
      <span className="member-name">{member.name}</span>
      {member.responsibilityPath && (
        <span className="member-boundary">{member.responsibilityPath}</span>
      )}
      <span className="member-type">
        {member.input} → {member.output}
      </span>
      <EffectBadges effects={member.effects} />
    </li>
  );
}

export function ActivityNode({ data, selected }: NodeProps<ActivityNodeType>) {
  const { activity, names, members } = data;
  const isComposite = activity.kind === "composite";
  const [expanded, setExpanded] = useState(false);

  const title = activity.kind === "atomic" ? (names[0] ?? activity.id) : names.join(" + ");
  const subtitle = isComposite ? `${names.length} 件の Activity を合成` : activity.id;
  const kindLabel = KIND_LABELS[activity.kind] ?? activity.kind;

  const ref = useRef<HTMLDivElement>(null);
  const report = useSizeReporter();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      report(activity.id, { width: el.offsetWidth, height: el.offsetHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activity.id, report]);

  const boundaryLabel = leafBoundaryLabel(activity.boundary);

  // With horizontal room to spare, an expanded fold spreads into columns so
  // the card grows sideways before it grows the lane vertically.
  const columns = isComposite && expanded ? memberColumns(members.length, data.expandMaxWidth) : 1;

  return (
    <div
      ref={ref}
      className={`activity-card${selected ? " is-selected" : ""}`}
      data-kind={activity.kind}
      data-expanded={isComposite && expanded ? "true" : undefined}
      style={columns > 1 ? { width: cardWidthFor(columns) } : undefined}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <Handle type="source" position={Position.Right} isConnectable={false} />
      {/* Effect edges leave from the left so they run in the gutter to the target lane
          instead of wrapping around from the right-hand flow handle. */}
      <Handle
        id="effect"
        type="source"
        position={Position.Left}
        isConnectable={false}
        className="effect-out-handle"
      />
      <div className="activity-card-head">
        <span className="activity-kind">{kindLabel}</span>
        <strong className="activity-title">{title}</strong>
      </div>
      <div className="activity-subtitle">{subtitle}</div>
      <div className="activity-type">
        {activity.input} → {activity.output}
      </div>
      <div className="activity-boundary">{boundaryLabel}</div>
      <EffectBadges effects={data.effects} />
      {isComposite && members.length > 0 && (
        <>
          <button
            type="button"
            className="member-toggle"
            aria-expanded={expanded}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((value) => !value);
            }}
          >
            {expanded ? "▾ 内訳を隠す" : `▸ 内訳を表示（${members.length}）`}
          </button>
          {expanded && (
            <ul
              className="activity-members"
              aria-label="合成された Activity の内訳"
              style={
                columns > 1
                  ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
                  : undefined
              }
            >
              {members.map((member) => (
                <MemberRow key={member.id} member={member} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// A boundary may be a full path "company:X|department:Y|team:Z" — show only
// the leaf value.
function leafBoundaryLabel(boundary: string): string {
  const parts = boundary.split("|");
  const last = parts[parts.length - 1] ?? boundary;
  const idx = last.indexOf(":");
  return idx >= 0 ? last.slice(idx + 1) : last;
}
