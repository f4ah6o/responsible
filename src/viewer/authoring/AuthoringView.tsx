import { useCallback, useEffect, useMemo, useState } from "react";

import { validateProcessModel } from "../../index.js";
import { useI18n } from "../i18n";
import { AuthoringCanvas, type AuthoringSelection } from "./AuthoringCanvas";
import { CardDetailPanel, ResponsibilityEditor } from "./CardDetailPanel";
import {
  addCard,
  addLaneHint,
  connect,
  createCard,
  createEffectEntry,
  createLaneHint,
  emptyDeck,
  removeCard,
  removeConnection,
  removeLaneHint,
  updateCard,
  updateConnection,
  updateLaneHint,
  type ActivityCardPatch,
  type CardDeck,
  type CardKind,
  type CardPosition,
  type FlowConnectionPatch,
} from "./cardDeck";
import { deckToProcessModel } from "./deckToModel";
import { clearStoredDeck, loadStoredDeck, saveStoredDeck } from "./deckStorage";
import { sampleDeck } from "./sampleDeck";

const MAX_SHOWN_ISSUES = 5;

export type AuthoringViewProps = {
  onClose: () => void;
  onOpenInViewer: (json: string, title: string) => void;
};

// Card authoring mode (issue #42): a Magica-style authoring layer that edits
// a card deck and converts it to a `responsible.v1` model. The semantic layer
// is untouched — validation below is the existing `validateProcessModel`, and
// "open in viewer" goes through the same import path as a JSON file.
export function AuthoringView({ onClose, onOpenInViewer }: AuthoringViewProps) {
  const { t } = useI18n();
  const [deck, setDeck] = useState<CardDeck>(() => loadStoredDeck() ?? emptyDeck());
  const [selection, setSelection] = useState<AuthoringSelection>(undefined);

  // Draft persistence is best-effort and continuous: the deck survives a
  // reload without an explicit save step.
  useEffect(() => {
    saveStoredDeck(deck);
  }, [deck]);

  const model = useMemo(() => deckToProcessModel(deck), [deck]);
  const validation = useMemo(() => validateProcessModel(model), [model]);
  const json = useMemo(() => JSON.stringify(model, null, 2), [model]);

  const handleAddCard = useCallback((kind: CardKind) => {
    setDeck((current) => {
      const position: CardPosition = {
        x: 80 + (current.cards.length % 4) * 240,
        y: 80 + Math.floor(current.cards.length / 4) * 160,
      };
      const card = createCard(current, kind, position);
      setSelection({ kind: "card", id: card.id });
      return addCard(current, card);
    });
  }, []);

  const handleUpdateCard = useCallback((id: string, patch: ActivityCardPatch) => {
    setDeck((current) => updateCard(current, id, patch));
  }, []);

  const handleMoveCard = useCallback((id: string, position: CardPosition) => {
    setDeck((current) => updateCard(current, id, { position }));
  }, []);

  const handleAddEffect = useCallback((cardId: string) => {
    setDeck((current) => {
      const card = current.cards.find((entry) => entry.id === cardId);
      if (!card) return current;
      return updateCard(current, cardId, { effects: [...card.effects, createEffectEntry(card)] });
    });
  }, []);

  const handleDeleteCard = useCallback((id: string) => {
    setDeck((current) => removeCard(current, id));
    setSelection(undefined);
  }, []);

  const handleConnectCards = useCallback((from: string, to: string) => {
    setDeck((current) => connect(current, from, to));
  }, []);

  const handleUpdateConnection = useCallback((id: string, patch: FlowConnectionPatch) => {
    setDeck((current) => updateConnection(current, id, patch));
  }, []);

  const handleDeleteConnection = useCallback((id: string) => {
    setDeck((current) => removeConnection(current, id));
    setSelection(undefined);
  }, []);

  const handleAddLaneHint = useCallback(() => {
    setDeck((current) => addLaneHint(current, createLaneHint(current, "")));
  }, []);

  const handleApplyLaneHint = useCallback(
    (hintId: string) => {
      if (selection?.kind !== "card") return;
      setDeck((current) => {
        const hint = current.laneHints.find((entry) => entry.id === hintId);
        if (!hint) return current;
        return updateCard(current, selection.id, { responsibility: hint.responsibility });
      });
    },
    [selection],
  );

  const handleLoadSample = useCallback(() => {
    if (deck.cards.length > 0 && !window.confirm(t("confirmReplaceDeck"))) return;
    setDeck(sampleDeck());
    setSelection(undefined);
  }, [deck.cards.length, t]);

  const handleClear = useCallback(() => {
    if (deck.cards.length > 0 && !window.confirm(t("confirmClearDeck"))) return;
    setDeck(emptyDeck());
    setSelection(undefined);
    clearStoredDeck();
  }, [deck.cards.length, t]);

  const deckTitle = deck.title.trim() || t("authoredTitleFallback");

  const handleExport = useCallback(() => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${deckTitle}.v1.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [json, deckTitle]);

  const handleOpenInViewer = useCallback(() => {
    onOpenInViewer(json, deckTitle);
  }, [onOpenInViewer, json, deckTitle]);

  const issues = validation.ok ? [] : validation.issues;

  return (
    <div className="authoring">
      <header className="authoring-header">
        <button type="button" className="secondary-action" onClick={onClose}>
          {t("authoringClose")}
        </button>
        <label className="authoring-title-field">
          <span>{t("authoringTitleLabel")}</span>
          <input
            type="text"
            value={deck.title}
            placeholder={t("authoringTitlePlaceholder")}
            onChange={(event) => setDeck((current) => ({ ...current, title: event.target.value }))}
          />
        </label>
        <span
          className={validation.ok ? "authoring-status is-valid" : "authoring-status is-invalid"}
          role="status"
        >
          {validation.ok ? t("validationOk") : t("validationIssues", { count: issues.length })}
        </span>
        <button type="button" className="secondary-action" onClick={handleLoadSample}>
          {t("loadSampleDeck")}
        </button>
        <button type="button" className="secondary-action" onClick={handleClear}>
          {t("clearDeck")}
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={handleExport}
          disabled={!validation.ok}
        >
          {t("exportDeckJson")}
        </button>
        <button
          type="button"
          className="primary-action"
          onClick={handleOpenInViewer}
          disabled={!validation.ok}
        >
          {t("openInViewer")}
        </button>
      </header>
      <aside className="authoring-palette" aria-label={t("paletteHeading")}>
        <h3>{t("paletteHeading")}</h3>
        <button type="button" className="primary-action" onClick={() => handleAddCard("activity")}>
          {t("addActivityCard")}
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={() => handleAddCard("decision")}
        >
          {t("addDecisionCard")}
        </button>
        <p className="authoring-palette-hint">{t("paletteHint")}</p>
        <h3>{t("laneHintsHeading")}</h3>
        {deck.laneHints.map((hint) => (
          <details key={hint.id} className="authoring-lane-hint">
            <summary>{hint.label.trim() || t("cardUntitled")}</summary>
            <label className="authoring-field">
              <span>{t("laneHintLabelPlaceholder")}</span>
              <input
                type="text"
                value={hint.label}
                onChange={(event) =>
                  setDeck((current) =>
                    updateLaneHint(current, hint.id, { label: event.target.value }),
                  )
                }
              />
            </label>
            <ResponsibilityEditor
              value={hint.responsibility}
              onChange={(responsibility) =>
                setDeck((current) => updateLaneHint(current, hint.id, { responsibility }))
              }
            />
            <button
              type="button"
              className="secondary-action"
              onClick={() => handleApplyLaneHint(hint.id)}
              disabled={selection?.kind !== "card"}
            >
              {t("applyLaneHint")}
            </button>
            <button
              type="button"
              className="authoring-delete"
              onClick={() => setDeck((current) => removeLaneHint(current, hint.id))}
            >
              {t("removeLaneHint")}
            </button>
          </details>
        ))}
        <button type="button" className="secondary-action" onClick={handleAddLaneHint}>
          {t("addLaneHint")}
        </button>
      </aside>
      <div className="authoring-canvas">
        <AuthoringCanvas
          deck={deck}
          selection={selection}
          onSelect={setSelection}
          onConnectCards={handleConnectCards}
          onMoveCard={handleMoveCard}
        />
      </div>
      <CardDetailPanel
        deck={deck}
        selection={selection}
        onUpdateCard={handleUpdateCard}
        onAddEffect={handleAddEffect}
        onDeleteCard={handleDeleteCard}
        onUpdateConnection={handleUpdateConnection}
        onDeleteConnection={handleDeleteConnection}
      />
      <section className="authoring-preview">
        {!validation.ok && (
          <ul className="authoring-issues" role="alert">
            {issues.slice(0, MAX_SHOWN_ISSUES).map((issue, index) => (
              <li key={index}>
                <code>{issue.path}</code> {issue.message}
              </li>
            ))}
            {issues.length > MAX_SHOWN_ISSUES && (
              <li>{t("effectIssuesMore", { count: issues.length - MAX_SHOWN_ISSUES })}</li>
            )}
          </ul>
        )}
        <details>
          <summary>{t("previewHeading")}</summary>
          <pre>{json}</pre>
        </details>
      </section>
    </div>
  );
}
