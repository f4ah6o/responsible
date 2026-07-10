import type {
  ActivityDef,
  EffectDef,
  FlowDef,
  Id,
  ProcessModel,
  Responsibility,
} from "../../model.js";
import type { ActivityCard, CardDeck, EffectCardEntry, FlowConnection } from "./cardDeck.js";

// Adapter from the card authoring layer to the semantic layer: a card deck
// becomes a flat `responsible.v1` ProcessModel. The adapter never throws and
// never invents structure — structural problems (empty deck, blank input/
// output, dangling connections) are reported by the existing
// `validateProcessModel` on the result, which is the authoring UI's live
// feedback loop.

function trimmed(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

function responsibilityOf(fields: ActivityCard["responsibility"]): Responsibility | undefined {
  const entries = Object.entries(fields)
    .map(([axis, value]) => [axis, value?.trim() ?? ""] as const)
    .filter(([, value]) => value !== "");
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
}

function effectOf(entry: EffectCardEntry): EffectDef {
  const payload = { kind: entry.payloadKind, schema: entry.schema.trim() } as const;
  if (entry.mode === "directed") {
    return {
      payload,
      delivery: { mode: "directed", target: responsibilityOf(entry.target) ?? {} },
    };
  }
  return { payload, delivery: { mode: entry.mode } };
}

function factsOf(facts: readonly string[]): readonly string[] | undefined {
  const cleaned = facts.map((fact) => fact.trim()).filter((fact) => fact !== "");
  return cleaned.length > 0 ? cleaned : undefined;
}

function activityOf(card: ActivityCard): ActivityDef {
  const responsibility = responsibilityOf(card.responsibility);
  const requires = factsOf(card.requires);
  const ensures = factsOf(card.ensures);
  const effects = card.effects.length > 0 ? card.effects.map(effectOf) : undefined;
  const name = trimmed(card.title);
  return {
    id: card.id,
    ...(name ? { name } : {}),
    input: card.input.trim(),
    output: card.output.trim(),
    ...(responsibility ? { responsibility } : {}),
    ...(card.status ? { status: card.status } : {}),
    ...(requires ? { requires } : {}),
    ...(ensures ? { ensures } : {}),
    ...(effects ? { effects } : {}),
  };
}

// A connection leaving a Decision card carries the chosen outcome as a flow
// mapping ("when output = approved") — branching stays in FlowDef, and the
// Decision card itself is an ordinary Activity. An explicit mapping wins.
function flowOf(connection: FlowConnection): FlowDef {
  const mapping =
    trimmed(connection.mapping) ??
    (trimmed(connection.outcome) ? `when output = ${connection.outcome!.trim()}` : undefined);
  const contract = trimmed(connection.contract);
  return {
    from: connection.from,
    to: connection.to,
    ...(mapping ? { mapping } : {}),
    ...(contract ? { contract } : {}),
  };
}

/**
 * Converts a card deck to a flat `responsible.v1` model. The viewer's
 * existing `ensureRootActivity` wraps flat models in a synthetic root, so the
 * deck never needs to model decomposition explicitly.
 */
export function deckToProcessModel(deck: CardDeck): ProcessModel {
  const activities: Record<Id, ActivityDef> = {};
  for (const card of deck.cards) {
    activities[card.id] = activityOf(card);
  }
  return {
    schemaVersion: "responsible.v1",
    activities,
    flows: deck.connections.map(flowOf),
  };
}
