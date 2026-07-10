import type { ActivityStatus } from "../../model.js";
import { useI18n, type MessageKey } from "../i18n";
import type { AuthoringSelection } from "./AuthoringCanvas";
import {
  RESPONSIBILITY_AXES,
  type ActivityCard,
  type ActivityCardPatch,
  type CardDeck,
  type EffectCardEntry,
  type FlowConnection,
  type FlowConnectionPatch,
  type ResponsibilityAxis,
  type ResponsibilityFields,
} from "./cardDeck";

const AXIS_LABEL_KEYS: Record<ResponsibilityAxis, MessageKey> = {
  company: "boundaryCompany",
  department: "boundaryDepartment",
  section: "boundarySection",
  team: "boundaryTeam",
  person: "boundaryPerson",
};

const STATUS_VALUES: readonly ActivityStatus[] = [
  "discovered",
  "defined",
  "validated",
  "automatable",
];

type ResponsibilityEditorProps = {
  value: ResponsibilityFields;
  onChange: (value: ResponsibilityFields) => void;
};

// The Responsibility card as an editing surface: five axis fields writing
// `ActivityDef.responsibility` (or an effect's directed target).
export function ResponsibilityEditor({ value, onChange }: ResponsibilityEditorProps) {
  const { t } = useI18n();
  return (
    <div className="authoring-responsibility">
      {RESPONSIBILITY_AXES.map((axis) => (
        <label key={axis} className="authoring-field">
          <span>{t(AXIS_LABEL_KEYS[axis])}</span>
          <input
            type="text"
            value={value[axis] ?? ""}
            onChange={(event) => onChange({ ...value, [axis]: event.target.value })}
          />
        </label>
      ))}
    </div>
  );
}

type FactListEditorProps = {
  heading: string;
  facts: readonly string[];
  onChange: (facts: readonly string[]) => void;
};

// Condition cards (requires / ensures) attached to the selected card.
function FactListEditor({ heading, facts, onChange }: FactListEditorProps) {
  const { t } = useI18n();
  return (
    <section className="authoring-subcards">
      <h4>{heading}</h4>
      {facts.map((fact, index) => (
        <div key={index} className="authoring-subcard-row">
          <input
            type="text"
            value={fact}
            onChange={(event) =>
              onChange(facts.map((entry, i) => (i === index ? event.target.value : entry)))
            }
          />
          <button
            type="button"
            aria-label={t("removeEntryAriaLabel")}
            onClick={() => onChange(facts.filter((_, i) => i !== index))}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="secondary-action" onClick={() => onChange([...facts, ""])}>
        {t("addCondition")}
      </button>
    </section>
  );
}

type EffectListEditorProps = {
  effects: readonly EffectCardEntry[];
  onChange: (effects: readonly EffectCardEntry[]) => void;
  onAdd: () => void;
};

// Effect cards attached to the selected card, editing `ActivityDef.effects`.
function EffectListEditor({ effects, onChange, onAdd }: EffectListEditorProps) {
  const { t } = useI18n();
  const patch = (id: string, changes: Partial<EffectCardEntry>) =>
    onChange(effects.map((effect) => (effect.id === id ? { ...effect, ...changes } : effect)));
  return (
    <section className="authoring-subcards">
      <h4>{t("effectsHeading")}</h4>
      {effects.map((effect) => (
        <div key={effect.id} className="authoring-effect-card">
          <div className="authoring-subcard-row">
            <select
              value={effect.payloadKind}
              onChange={(event) =>
                patch(effect.id, {
                  payloadKind: event.target.value as EffectCardEntry["payloadKind"],
                })
              }
            >
              <option value="domain-fact">domain-fact</option>
              <option value="command">command</option>
              <option value="data">data</option>
            </select>
            <select
              value={effect.mode}
              onChange={(event) =>
                patch(effect.id, { mode: event.target.value as EffectCardEntry["mode"] })
              }
            >
              <option value="directed">directed</option>
              <option value="broadcast">broadcast</option>
              <option value="observable">observable</option>
            </select>
            <button
              type="button"
              aria-label={t("removeEntryAriaLabel")}
              onClick={() => onChange(effects.filter((entry) => entry.id !== effect.id))}
            >
              ×
            </button>
          </div>
          <input
            type="text"
            placeholder={t("effectSchemaPlaceholder")}
            value={effect.schema}
            onChange={(event) => patch(effect.id, { schema: event.target.value })}
          />
          {effect.mode === "directed" && (
            <>
              <h5>{t("effectTargetHeading")}</h5>
              <ResponsibilityEditor
                value={effect.target}
                onChange={(target) => patch(effect.id, { target })}
              />
            </>
          )}
        </div>
      ))}
      <button type="button" className="secondary-action" onClick={onAdd}>
        {t("addEffect")}
      </button>
    </section>
  );
}

type CardEditorProps = {
  card: ActivityCard;
  onUpdate: (patch: ActivityCardPatch) => void;
  onAddEffect: () => void;
  onDelete: () => void;
};

function CardEditor({ card, onUpdate, onAddEffect, onDelete }: CardEditorProps) {
  const { t } = useI18n();
  return (
    <>
      <label className="authoring-field">
        <span>{t("fieldTitle")}</span>
        <input
          type="text"
          value={card.title}
          onChange={(event) => onUpdate({ title: event.target.value })}
        />
      </label>
      <label className="authoring-field">
        <span>{t("fieldInput")}</span>
        <input
          type="text"
          value={card.input}
          onChange={(event) => onUpdate({ input: event.target.value })}
        />
      </label>
      <label className="authoring-field">
        <span>{t("fieldOutput")}</span>
        <input
          type="text"
          value={card.output}
          onChange={(event) => onUpdate({ output: event.target.value })}
        />
      </label>
      <label className="authoring-field">
        <span>{t("fieldStatus")}</span>
        <select
          value={card.status ?? ""}
          onChange={(event) =>
            onUpdate({
              status:
                event.target.value === "" ? undefined : (event.target.value as ActivityStatus),
            })
          }
        >
          <option value="">{t("statusNone")}</option>
          {STATUS_VALUES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <section className="authoring-subcards">
        <h4>{t("responsibilityHeading")}</h4>
        <ResponsibilityEditor
          value={card.responsibility}
          onChange={(responsibility) => onUpdate({ responsibility })}
        />
      </section>
      {card.kind === "decision" && (
        <FactListEditor
          heading={t("outcomesHeading")}
          facts={card.outcomes}
          onChange={(outcomes) => onUpdate({ outcomes })}
        />
      )}
      <FactListEditor
        heading={t("requiresHeading")}
        facts={card.requires}
        onChange={(requires) => onUpdate({ requires })}
      />
      <FactListEditor
        heading={t("ensuresHeading")}
        facts={card.ensures}
        onChange={(ensures) => onUpdate({ ensures })}
      />
      <EffectListEditor
        effects={card.effects}
        onChange={(effects) => onUpdate({ effects })}
        onAdd={onAddEffect}
      />
      <button type="button" className="authoring-delete" onClick={onDelete}>
        {t("deleteCard")}
      </button>
    </>
  );
}

type ConnectionEditorProps = {
  connection: FlowConnection;
  fromCard: ActivityCard | undefined;
  toCard: ActivityCard | undefined;
  onUpdate: (patch: FlowConnectionPatch) => void;
  onDelete: () => void;
};

function ConnectionEditor({
  connection,
  fromCard,
  toCard,
  onUpdate,
  onDelete,
}: ConnectionEditorProps) {
  const { t } = useI18n();
  const outcomes = fromCard?.kind === "decision" ? fromCard.outcomes : [];
  return (
    <>
      <p className="authoring-connection-route">
        {fromCard?.title.trim() || connection.from} → {toCard?.title.trim() || connection.to}
      </p>
      {outcomes.length > 0 && (
        <label className="authoring-field">
          <span>{t("connectionOutcomeLabel")}</span>
          <select
            value={connection.outcome ?? ""}
            onChange={(event) =>
              onUpdate({ outcome: event.target.value === "" ? undefined : event.target.value })
            }
          >
            <option value="">{t("connectionOutcomeNone")}</option>
            {outcomes
              .filter((outcome) => outcome.trim() !== "")
              .map((outcome) => (
                <option key={outcome} value={outcome}>
                  {outcome}
                </option>
              ))}
          </select>
        </label>
      )}
      <label className="authoring-field">
        <span>{t("connectionMappingLabel")}</span>
        <input
          type="text"
          value={connection.mapping ?? ""}
          onChange={(event) =>
            onUpdate({ mapping: event.target.value === "" ? undefined : event.target.value })
          }
        />
      </label>
      <label className="authoring-field">
        <span>{t("connectionContractLabel")}</span>
        <input
          type="text"
          value={connection.contract ?? ""}
          onChange={(event) =>
            onUpdate({ contract: event.target.value === "" ? undefined : event.target.value })
          }
        />
      </label>
      <button type="button" className="authoring-delete" onClick={onDelete}>
        {t("deleteConnection")}
      </button>
    </>
  );
}

export type CardDetailPanelProps = {
  deck: CardDeck;
  selection: AuthoringSelection;
  onUpdateCard: (id: string, patch: ActivityCardPatch) => void;
  onAddEffect: (cardId: string) => void;
  onDeleteCard: (id: string) => void;
  onUpdateConnection: (id: string, patch: FlowConnectionPatch) => void;
  onDeleteConnection: (id: string) => void;
};

export function CardDetailPanel({
  deck,
  selection,
  onUpdateCard,
  onAddEffect,
  onDeleteCard,
  onUpdateConnection,
  onDeleteConnection,
}: CardDetailPanelProps) {
  const { t } = useI18n();

  const card =
    selection?.kind === "card" ? deck.cards.find((entry) => entry.id === selection.id) : undefined;
  const connection =
    selection?.kind === "connection"
      ? deck.connections.find((entry) => entry.id === selection.id)
      : undefined;

  return (
    <aside className="authoring-detail" aria-label={t("detailHeading")}>
      <h3>{connection ? t("connectionHeading") : t("detailHeading")}</h3>
      {card && (
        <CardEditor
          card={card}
          onUpdate={(patch) => onUpdateCard(card.id, patch)}
          onAddEffect={() => onAddEffect(card.id)}
          onDelete={() => onDeleteCard(card.id)}
        />
      )}
      {connection && (
        <ConnectionEditor
          connection={connection}
          fromCard={deck.cards.find((entry) => entry.id === connection.from)}
          toCard={deck.cards.find((entry) => entry.id === connection.to)}
          onUpdate={(patch) => onUpdateConnection(connection.id, patch)}
          onDelete={() => onDeleteConnection(connection.id)}
        />
      )}
      {!card && !connection && <p className="authoring-detail-empty">{t("detailEmpty")}</p>}
    </aside>
  );
}
