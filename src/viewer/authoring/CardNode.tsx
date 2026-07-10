import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import { useI18n } from "../i18n";
import type { ActivityCard } from "./cardDeck";

export type CardNodeData = {
  card: ActivityCard;
  isSelected: boolean;
};

type CardNodeType = Node<CardNodeData, "card">;

function responsibilitySummary(card: ActivityCard): string {
  const values = Object.values(card.responsibility)
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return values.length > 0 ? (values[values.length - 1] ?? "") : "";
}

export function CardNode({ data }: NodeProps<CardNodeType>) {
  const { t } = useI18n();
  const { card, isSelected } = data;
  const boundary = responsibilitySummary(card);
  const conditionCount = card.requires.length + card.ensures.length;

  return (
    <div className={`authoring-card${isSelected ? " is-selected" : ""}`} data-card-kind={card.kind}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="authoring-card-head">
        <span className="authoring-card-kind">
          {card.kind === "decision" ? t("cardKindDecision") : t("cardKindActivity")}
        </span>
        <strong className="authoring-card-title">{card.title.trim() || t("cardUntitled")}</strong>
      </div>
      {(card.input.trim() || card.output.trim()) && (
        <div className="authoring-card-type">
          {card.input.trim() || "?"} → {card.output.trim() || "?"}
        </div>
      )}
      {boundary && <div className="authoring-card-boundary">{boundary}</div>}
      {(conditionCount > 0 || card.effects.length > 0) && (
        <div className="authoring-card-chips">
          {card.requires.length > 0 && (
            <span className="authoring-card-chip">requires {card.requires.length}</span>
          )}
          {card.ensures.length > 0 && (
            <span className="authoring-card-chip">ensures {card.ensures.length}</span>
          )}
          {card.effects.length > 0 && (
            <span className="authoring-card-chip" data-chip="effect">
              effects {card.effects.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
