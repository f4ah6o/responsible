import type { ActivityStatus, EffectPayloadKind } from "../../model.js";

// Magica-style card deck: the serializable authoring state of the card
// authoring mode. Cards are an authoring-layer vocabulary only — they are
// converted to a `responsible.v1` ProcessModel by `deckToModel.ts` and never
// leak into the semantic core. See docs/card-authoring.md.

export const CARD_DECK_VERSION = "responsible.card-deck.v1";

export const RESPONSIBILITY_AXES = ["company", "department", "section", "team", "person"] as const;

export type ResponsibilityAxis = (typeof RESPONSIBILITY_AXES)[number];

// Partial by design: an author fills in only the axes they know.
export type ResponsibilityFields = Readonly<Partial<Record<ResponsibilityAxis, string>>>;

// A Decision card is not a gateway: it converts to an Activity whose output
// is a decision-result type, with branching expressed on outgoing connections.
export type CardKind = "activity" | "decision";

export type EffectDeliveryMode = "directed" | "broadcast" | "observable";

// Effect card: attached to an Activity card, edits one entry of
// `ActivityDef.effects`.
export type EffectCardEntry = Readonly<{
  id: string;
  payloadKind: EffectPayloadKind;
  schema: string;
  mode: EffectDeliveryMode;
  target: ResponsibilityFields; // used when mode === "directed"
}>;

export type CardPosition = Readonly<{ x: number; y: number }>;

// Condition cards (requires / ensures) live as plain fact strings on the
// owning Activity card; a Responsibility card is the `responsibility` fields.
export type ActivityCard = Readonly<{
  id: string;
  kind: CardKind;
  title: string;
  input: string;
  output: string;
  responsibility: ResponsibilityFields;
  status?: ActivityStatus;
  requires: readonly string[];
  ensures: readonly string[];
  effects: readonly EffectCardEntry[];
  outcomes: readonly string[]; // decision cards only
  position: CardPosition; // canvas geometry, never exported to the model
}>;

export type FlowConnection = Readonly<{
  id: string;
  from: string;
  to: string;
  outcome?: string; // decision branch — becomes `mapping: "when output = <outcome>"`
  mapping?: string; // explicit mapping wins over `outcome`
  contract?: string;
}>;

// Lane hint card: a reusable responsibility preset the author can stamp onto
// cards. Purely an authoring convenience; not part of the model document.
export type LaneHintCard = Readonly<{
  id: string;
  label: string;
  responsibility: ResponsibilityFields;
}>;

export type CardDeck = Readonly<{
  version: typeof CARD_DECK_VERSION;
  title: string;
  cards: readonly ActivityCard[];
  connections: readonly FlowConnection[];
  laneHints: readonly LaneHintCard[];
}>;

export type CardDeckValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type CardDeckValidationOptions = Readonly<{
  /** Allow blank/duplicate blank outcomes while a draft editor is mid-edit. */
  allowIncomplete?: boolean;
}>;

export function emptyDeck(title = ""): CardDeck {
  return { version: CARD_DECK_VERSION, title, cards: [], connections: [], laneHints: [] };
}

function nextId(prefix: string, taken: ReadonlySet<string>): string {
  for (let n = 1; ; n += 1) {
    const candidate = `${prefix}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function takenCardIds(deck: CardDeck): ReadonlySet<string> {
  return new Set(deck.cards.map((card) => card.id));
}

// Ids are generated once at creation and stay stable across renames — they
// become the Activity ids of the generated model.
export function createCard(deck: CardDeck, kind: CardKind, position: CardPosition): ActivityCard {
  return {
    id: nextId(kind, takenCardIds(deck)),
    kind,
    title: "",
    input: "",
    output: kind === "decision" ? "判断結果" : "",
    responsibility: {},
    requires: [],
    ensures: [],
    effects: [],
    outcomes: kind === "decision" ? ["approved", "rejected"] : [],
    position,
  };
}

export function createLaneHint(deck: CardDeck, label: string): LaneHintCard {
  const taken = new Set(deck.laneHints.map((hint) => hint.id));
  return { id: nextId("lane", taken), label, responsibility: {} };
}

export function createEffectEntry(card: ActivityCard): EffectCardEntry {
  const taken = new Set(card.effects.map((effect) => effect.id));
  return {
    id: nextId("effect", taken),
    payloadKind: "data",
    schema: "",
    mode: "directed",
    target: {},
  };
}

export function addCard(deck: CardDeck, card: ActivityCard): CardDeck {
  return { ...deck, cards: [...deck.cards, card] };
}

// Patches may set an optional field to `undefined` to clear it — merged with
// key deletion so the result satisfies exactOptionalPropertyTypes.
export type ActivityCardPatch = {
  [K in keyof Omit<ActivityCard, "id" | "kind">]?: ActivityCard[K] | undefined;
};

export type FlowConnectionPatch = {
  [K in keyof Omit<FlowConnection, "id" | "from" | "to">]?: FlowConnection[K] | undefined;
};

function merge<T extends object>(base: T, patch: Readonly<Record<string, unknown>>): T {
  const next = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next as T;
}

export function updateCard(deck: CardDeck, id: string, patch: ActivityCardPatch): CardDeck {
  const previous = deck.cards.find((card) => card.id === id);
  const nextDeck: CardDeck = {
    ...deck,
    cards: deck.cards.map((card) => (card.id === id ? merge(card, patch) : card)),
  };
  if (!previous || patch.outcomes === undefined || previous.kind !== "decision") return nextDeck;

  const nextCard = nextDeck.cards.find((card) => card.id === id);
  if (!nextCard) return nextDeck;
  return {
    ...nextDeck,
    connections: synchronizeDecisionOutcomes(
      nextDeck.connections,
      previous.outcomes,
      nextCard.outcomes,
      id,
    ),
  };
}

function synchronizeDecisionOutcomes(
  connections: readonly FlowConnection[],
  previousOutcomes: readonly string[],
  nextOutcomes: readonly string[],
  decisionId: string,
): readonly FlowConnection[] {
  const previous = previousOutcomes.map((outcome) => outcome.trim());
  const next = nextOutcomes.map((outcome) => outcome.trim());
  const nextSet = new Set(next.filter(Boolean));
  const previousSet = new Set(previous.filter(Boolean));
  const removed = previous.filter((outcome) => outcome && !nextSet.has(outcome));
  const added = next.filter((outcome) => outcome && !previousSet.has(outcome));
  const renames = new Map<string, string>();

  // A one-for-one replacement is the only unambiguous rename signal exposed
  // by the list editor. Pure deletions therefore clear references instead of
  // silently redirecting them to a neighboring outcome.
  if (removed.length === added.length && removed.length > 0) {
    for (let index = 0; index < removed.length; index += 1) {
      renames.set(removed[index]!, added[index]!);
    }
  }

  return connections.map((connection) => {
    if (connection.from !== decisionId || connection.outcome === undefined) return connection;
    const current = connection.outcome.trim();
    const canonical = next.find((outcome) => outcome === current);
    if (canonical !== undefined) return { ...connection, outcome: canonical };
    const renamed = renames.get(current);
    if (renamed !== undefined) return { ...connection, outcome: renamed };
    const { outcome: _outcome, ...withoutOutcome } = connection;
    return withoutOutcome;
  });
}

// Removing a card also removes every connection touching it.
export function removeCard(deck: CardDeck, id: string): CardDeck {
  return {
    ...deck,
    cards: deck.cards.filter((card) => card.id !== id),
    connections: deck.connections.filter(
      (connection) => connection.from !== id && connection.to !== id,
    ),
  };
}

export function connect(deck: CardDeck, from: string, to: string): CardDeck {
  if (from === to) return deck;
  if (!deck.cards.some((card) => card.id === from) || !deck.cards.some((card) => card.id === to)) {
    return deck;
  }
  if (deck.connections.some((connection) => connection.from === from && connection.to === to)) {
    return deck;
  }
  const taken = new Set(deck.connections.map((connection) => connection.id));
  return {
    ...deck,
    connections: [...deck.connections, { id: nextId("flow", taken), from, to }],
  };
}

export function updateConnection(deck: CardDeck, id: string, patch: FlowConnectionPatch): CardDeck {
  return {
    ...deck,
    connections: deck.connections.map((connection) =>
      connection.id === id ? merge(connection, patch) : connection,
    ),
  };
}

export function removeConnection(deck: CardDeck, id: string): CardDeck {
  return {
    ...deck,
    connections: deck.connections.filter((connection) => connection.id !== id),
  };
}

export function addLaneHint(deck: CardDeck, hint: LaneHintCard): CardDeck {
  return { ...deck, laneHints: [...deck.laneHints, hint] };
}

export function updateLaneHint(
  deck: CardDeck,
  id: string,
  patch: Partial<Omit<LaneHintCard, "id">>,
): CardDeck {
  return {
    ...deck,
    laneHints: deck.laneHints.map((hint) => (hint.id === id ? { ...hint, ...patch } : hint)),
  };
}

export function removeLaneHint(deck: CardDeck, id: string): CardDeck {
  return { ...deck, laneHints: deck.laneHints.filter((hint) => hint.id !== id) };
}

function isResponsibilityFields(value: unknown): value is ResponsibilityFields {
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).every(
    ([key, entry]) =>
      (RESPONSIBILITY_AXES as readonly string[]).includes(key) && typeof entry === "string",
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isEffectEntry(value: unknown): value is EffectCardEntry {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["id"] === "string" &&
    record["id"].length > 0 &&
    (record["payloadKind"] === "domain-fact" ||
      record["payloadKind"] === "command" ||
      record["payloadKind"] === "data") &&
    typeof record["schema"] === "string" &&
    (record["mode"] === "directed" ||
      record["mode"] === "broadcast" ||
      record["mode"] === "observable") &&
    isResponsibilityFields(record["target"])
  );
}

function isCard(value: unknown): value is ActivityCard {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const position = record["position"] as Record<string, unknown> | undefined;
  return (
    typeof record["id"] === "string" &&
    record["id"].length > 0 &&
    (record["kind"] === "activity" || record["kind"] === "decision") &&
    typeof record["title"] === "string" &&
    typeof record["input"] === "string" &&
    typeof record["output"] === "string" &&
    isResponsibilityFields(record["responsibility"]) &&
    (record["status"] === undefined ||
      record["status"] === "discovered" ||
      record["status"] === "defined" ||
      record["status"] === "validated" ||
      record["status"] === "automatable") &&
    isStringArray(record["requires"]) &&
    isStringArray(record["ensures"]) &&
    Array.isArray(record["effects"]) &&
    record["effects"].every(isEffectEntry) &&
    isStringArray(record["outcomes"]) &&
    typeof position === "object" &&
    position !== null &&
    typeof position["x"] === "number" &&
    Number.isFinite(position["x"]) &&
    Math.abs(position["x"]) <= 1_000_000 &&
    typeof position["y"] === "number" &&
    Number.isFinite(position["y"]) &&
    Math.abs(position["y"]) <= 1_000_000
  );
}

function isConnection(value: unknown): value is FlowConnection {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["id"] === "string" &&
    record["id"].length > 0 &&
    typeof record["from"] === "string" &&
    typeof record["to"] === "string" &&
    (record["outcome"] === undefined || typeof record["outcome"] === "string") &&
    (record["mapping"] === undefined || typeof record["mapping"] === "string") &&
    (record["contract"] === undefined || typeof record["contract"] === "string")
  );
}

function isLaneHint(value: unknown): value is LaneHintCard {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["id"] === "string" &&
    record["id"].length > 0 &&
    typeof record["label"] === "string" &&
    isResponsibilityFields(record["responsibility"])
  );
}

/**
 * Checks semantic invariants for persisted or in-memory authoring decks.
 * Shape parsing and this semantic pass are intentionally separate: an
 * authoring draft may still have blank model fields, but it must never have
 * ambiguous ids, dangling references, invalid geometry, or stale decision
 * branches when it is exported or restored.
 */
export function validateCardDeck(
  deck: CardDeck,
  options: CardDeckValidationOptions = {},
): readonly CardDeckValidationIssue[] {
  const issues: CardDeckValidationIssue[] = [];
  const allowIncomplete = options.allowIncomplete === true;
  const cardIds = new Set<string>();
  const connectionIds = new Set<string>();
  const laneHintIds = new Set<string>();
  const cardsById = new Map(deck.cards.map((card) => [card.id, card]));

  for (const [index, card] of deck.cards.entries()) {
    if (cardIds.has(card.id)) {
      issues.push({
        path: `$.cards[${index}].id`,
        message: `card id "${card.id}" が重複しています`,
      });
    }
    cardIds.add(card.id);

    const effectIds = new Set<string>();
    for (const [effectIndex, effect] of card.effects.entries()) {
      if (effectIds.has(effect.id)) {
        issues.push({
          path: `$.cards[${index}].effects[${effectIndex}].id`,
          message: `effect id "${effect.id}" が同一カード内で重複しています`,
        });
      }
      effectIds.add(effect.id);
    }

    const trimmedOutcomes = card.outcomes.map((outcome) => outcome.trim());
    if (card.kind === "decision") {
      const outcomeIds = new Set<string>();
      for (const [outcomeIndex, outcome] of trimmedOutcomes.entries()) {
        if (outcome.length === 0) {
          if (allowIncomplete) continue;
          issues.push({
            path: `$.cards[${index}].outcomes[${outcomeIndex}]`,
            message: "Decision outcome は空でない文字列である必要があります",
          });
        } else if (outcomeIds.has(outcome)) {
          issues.push({
            path: `$.cards[${index}].outcomes[${outcomeIndex}]`,
            message: `Decision outcome "${outcome}" が重複しています`,
          });
        }
        outcomeIds.add(outcome);
      }
    } else if (card.outcomes.length > 0) {
      issues.push({
        path: `$.cards[${index}].outcomes`,
        message: "outcomes は Decision card にだけ指定できます",
      });
    }

    if (!Number.isFinite(card.position.x) || !Number.isFinite(card.position.y)) {
      issues.push({
        path: `$.cards[${index}].position`,
        message: "position は有限数である必要があります",
      });
    } else if (Math.abs(card.position.x) > 1_000_000 || Math.abs(card.position.y) > 1_000_000) {
      issues.push({
        path: `$.cards[${index}].position`,
        message: "position が安全な範囲を超えています",
      });
    }
  }

  const pairIds = new Set<string>();
  for (const [index, connection] of deck.connections.entries()) {
    if (connectionIds.has(connection.id)) {
      issues.push({
        path: `$.connections[${index}].id`,
        message: `connection id "${connection.id}" が重複しています`,
      });
    }
    connectionIds.add(connection.id);

    const from = cardsById.get(connection.from);
    const to = cardsById.get(connection.to);
    if (!from) {
      issues.push({
        path: `$.connections[${index}].from`,
        message: `未定義のcard "${connection.from}" を参照しています`,
      });
    }
    if (!to) {
      issues.push({
        path: `$.connections[${index}].to`,
        message: `未定義のcard "${connection.to}" を参照しています`,
      });
    }
    if (connection.from === connection.to) {
      issues.push({
        path: `$.connections[${index}]`,
        message: "connection は同じcardをfrom/toにできません",
      });
    }

    const pairKey = JSON.stringify([connection.from, connection.to]);
    if (pairIds.has(pairKey)) {
      issues.push({
        path: `$.connections[${index}]`,
        message: "同じfrom/toのconnectionが重複しています",
      });
    }
    pairIds.add(pairKey);

    const outcome = connection.outcome?.trim();
    if (connection.outcome !== undefined && !outcome) {
      issues.push({
        path: `$.connections[${index}].outcome`,
        message: "outcome は指定時に空でない文字列である必要があります",
      });
    } else if (outcome !== undefined && from?.kind !== "decision") {
      issues.push({
        path: `$.connections[${index}].outcome`,
        message: "outcome はDecision cardから出るconnectionにだけ指定できます",
      });
    } else if (
      outcome !== undefined &&
      from &&
      !from.outcomes.some((candidate) => candidate.trim() === outcome)
    ) {
      issues.push({
        path: `$.connections[${index}].outcome`,
        message: `存在しないDecision outcome "${outcome}" を参照しています`,
      });
    }
  }

  for (const [index, hint] of deck.laneHints.entries()) {
    if (laneHintIds.has(hint.id)) {
      issues.push({
        path: `$.laneHints[${index}].id`,
        message: `lane hint id "${hint.id}" が重複しています`,
      });
    }
    laneHintIds.add(hint.id);
  }

  return issues;
}

/**
 * Shape check for decks restored from persistence. Returns the deck when it
 * matches the current deck schema, otherwise `undefined`.
 */
export function parseCardDeck(value: unknown): CardDeck | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (record["version"] !== CARD_DECK_VERSION) return undefined;
  if (typeof record["title"] !== "string") return undefined;
  const cards = record["cards"];
  const connections = record["connections"];
  const laneHints = record["laneHints"];
  if (!Array.isArray(cards) || !cards.every(isCard)) return undefined;
  if (!Array.isArray(connections) || !connections.every(isConnection)) return undefined;
  if (!Array.isArray(laneHints) || !laneHints.every(isLaneHint)) return undefined;
  const deck: CardDeck = {
    version: CARD_DECK_VERSION,
    title: record["title"],
    cards,
    connections,
    laneHints,
  };
  // Persistence must preserve an editable draft (for example, the empty
  // outcome row created before its label is typed), while still rejecting
  // unsafe ids, dangling references, invalid geometry, and stale branches.
  return validateCardDeck(deck, { allowIncomplete: true }).length === 0 ? deck : undefined;
}
