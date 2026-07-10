import { test } from "node:test";
import assert from "node:assert/strict";

import {
  HIERARCHICAL_BOUNDARY_ORDER,
  ensureRootActivity,
  projectDagByResponsibilityBoundary,
  projectEffects,
  validateProcessModel,
} from "../index.js";
import type { ViewDef } from "../model.js";
import { sampleProcesses } from "../sample.js";
import {
  addCard,
  connect,
  createCard,
  createEffectEntry,
  emptyDeck,
  parseCardDeck,
  removeCard,
  updateCard,
  updateConnection,
} from "../viewer/authoring/cardDeck.js";
import { deckToProcessModel } from "../viewer/authoring/deckToModel.js";
import { sampleDeck } from "../viewer/authoring/sampleDeck.js";

test("empty deck converts to an empty v1 model that the validator rejects", () => {
  const model = deckToProcessModel(emptyDeck());
  assert.equal(model.schemaVersion, "responsible.v1");
  assert.deepEqual(model.activities, {});
  assert.deepEqual(model.flows, []);
  // Guardrail, not a crash: the existing validator reports the empty model.
  const result = validateProcessModel(model);
  assert.equal(result.ok, false);
});

test("card ids are generated uniquely per kind and survive renames", () => {
  let deck = emptyDeck();
  const first = createCard(deck, "activity", { x: 0, y: 0 });
  deck = addCard(deck, first);
  const second = createCard(deck, "activity", { x: 0, y: 0 });
  deck = addCard(deck, second);
  const decision = createCard(deck, "decision", { x: 0, y: 0 });
  deck = addCard(deck, decision);

  assert.deepEqual(
    deck.cards.map((card) => card.id),
    ["activity-1", "activity-2", "decision-1"],
  );

  deck = updateCard(deck, "activity-1", { title: "見積依頼を受け付ける" });
  assert.equal(deck.cards[0]?.id, "activity-1");
  assert.equal(deck.cards[0]?.title, "見積依頼を受け付ける");
});

test("adapter trims fields and omits empty optional declarations", () => {
  let deck = emptyDeck();
  deck = addCard(deck, {
    ...createCard(deck, "activity", { x: 0, y: 0 }),
    title: "  受付  ",
    input: " 依頼 ",
    output: " 受付済み依頼 ",
    responsibility: { company: "  ", department: "営業部", person: "" },
    requires: ["  ", "依頼が届いている"],
    ensures: [],
  });

  const activity = deckToProcessModel(deck).activities["activity-1"];
  assert.ok(activity);
  assert.equal(activity.name, "受付");
  assert.equal(activity.input, "依頼");
  assert.equal(activity.output, "受付済み依頼");
  assert.deepEqual(activity.responsibility, { department: "営業部" });
  assert.deepEqual(activity.requires, ["依頼が届いている"]);
  assert.equal(activity.ensures, undefined);
  assert.equal(activity.effects, undefined);
  assert.equal(activity.status, undefined);
});

test("a card with no title and no responsibility omits name and responsibility", () => {
  let deck = emptyDeck();
  deck = addCard(deck, createCard(deck, "activity", { x: 0, y: 0 }));
  const activity = deckToProcessModel(deck).activities["activity-1"];
  assert.ok(activity);
  assert.equal(activity.name, undefined);
  assert.equal(activity.responsibility, undefined);
});

test("decision outcomes become flow mappings; explicit mapping wins", () => {
  let deck = emptyDeck();
  deck = addCard(deck, {
    ...createCard(deck, "decision", { x: 0, y: 0 }),
    title: "承認可否を判断する",
  });
  deck = addCard(deck, { ...createCard(deck, "activity", { x: 0, y: 0 }), title: "承認する" });
  deck = addCard(deck, { ...createCard(deck, "activity", { x: 0, y: 0 }), title: "差し戻す" });
  deck = connect(deck, "decision-1", "activity-1");
  deck = connect(deck, "decision-1", "activity-2");
  deck = updateConnection(deck, "flow-1", { outcome: "approved" });
  deck = updateConnection(deck, "flow-2", {
    outcome: "need_revision",
    mapping: "when output = rejected or output = need_revision",
  });

  const flows = deckToProcessModel(deck).flows;
  assert.deepEqual(flows, [
    { from: "decision-1", to: "activity-1", mapping: "when output = approved" },
    {
      from: "decision-1",
      to: "activity-2",
      mapping: "when output = rejected or output = need_revision",
    },
  ]);
});

test("decision cards convert to plain Activities, not gateways", () => {
  let deck = emptyDeck();
  deck = addCard(deck, {
    ...createCard(deck, "decision", { x: 0, y: 0 }),
    title: "承認可否を判断する",
    input: "審査済み申請",
  });
  const activity = deckToProcessModel(deck).activities["decision-1"];
  assert.ok(activity);
  // The only trace of "decision" is the ordinary typed interface.
  assert.deepEqual(Object.keys(activity).sort(), ["id", "input", "name", "output"]);
  assert.equal(activity.output, "判断結果");
});

test("effect cards convert to EffectDefs with directed targets from non-empty axes", () => {
  let deck = emptyDeck();
  const card = createCard(deck, "activity", { x: 0, y: 0 });
  deck = addCard(deck, {
    ...card,
    title: "申請を提出する",
    input: "申請書",
    output: "提出済み申請",
    effects: [
      {
        ...createEffectEntry(card),
        payloadKind: "command",
        schema: " ApprovalRequest ",
        mode: "directed",
        target: { department: "管理部", person: "" },
      },
      {
        ...createEffectEntry(card),
        id: "effect-2",
        payloadKind: "domain-fact",
        schema: "Done",
        mode: "broadcast",
      },
    ],
  });

  const activity = deckToProcessModel(deck).activities["activity-1"];
  assert.deepEqual(activity?.effects, [
    {
      payload: { kind: "command", schema: "ApprovalRequest" },
      delivery: { mode: "directed", target: { department: "管理部" } },
    },
    { payload: { kind: "domain-fact", schema: "Done" }, delivery: { mode: "broadcast" } },
  ]);
});

test("removing a card removes the connections touching it", () => {
  let deck = emptyDeck();
  deck = addCard(deck, createCard(deck, "activity", { x: 0, y: 0 }));
  deck = addCard(deck, createCard(deck, "activity", { x: 0, y: 0 }));
  deck = connect(deck, "activity-1", "activity-2");
  assert.equal(deck.connections.length, 1);
  deck = removeCard(deck, "activity-2");
  assert.deepEqual(deck.connections, []);
});

test("connect ignores self-loops, duplicates, and unknown cards", () => {
  let deck = emptyDeck();
  deck = addCard(deck, createCard(deck, "activity", { x: 0, y: 0 }));
  deck = addCard(deck, createCard(deck, "activity", { x: 0, y: 0 }));
  deck = connect(deck, "activity-1", "activity-1");
  deck = connect(deck, "activity-1", "ghost");
  deck = connect(deck, "activity-1", "activity-2");
  deck = connect(deck, "activity-1", "activity-2");
  assert.equal(deck.connections.length, 1);
});

test("parseCardDeck round-trips a deck through JSON and rejects other shapes", () => {
  const deck = sampleDeck();
  assert.deepEqual(parseCardDeck(JSON.parse(JSON.stringify(deck))), deck);
  assert.equal(parseCardDeck(undefined), undefined);
  assert.equal(parseCardDeck({ version: "other" }), undefined);
  assert.equal(parseCardDeck({ version: "responsible.card-deck.v1", title: "x" }), undefined);
});

// Issue #42 acceptance: the bundled application_approval sample is
// reproducible from cards alone, and the generated model flows through the
// existing validator, projection, and effect projection unchanged.
test("sample deck reproduces the application_approval sample's leaves", () => {
  const model = deckToProcessModel(sampleDeck());
  const result = validateProcessModel(model);
  assert.ok(result.ok, JSON.stringify(result));

  const reference = sampleProcesses.find((process) => process.id === "application_approval");
  assert.ok(reference);
  const leaves = Object.fromEntries(
    Object.entries(reference.model.activities).filter(([id]) => id !== "application_approval"),
  );
  assert.deepEqual(model.activities, leaves);
  assert.deepEqual(model.flows, reference.model.flows);
});

test("sample deck's generated model projects at every boundary zoom level", () => {
  const model = deckToProcessModel(sampleDeck());
  const rooted = ensureRootActivity(model);

  for (let level = 0; level < HIERARCHICAL_BOUNDARY_ORDER.length; level += 1) {
    const boundary = HIERARCHICAL_BOUNDARY_ORDER.slice(0, level + 1);
    const view: ViewDef = {
      id: "test",
      layout: "lane",
      boundary,
      normalForm: "responsibilityBoundary",
    };
    const projected = projectDagByResponsibilityBoundary(model, view);
    assert.ok(projected.activities.length > 0);

    const effects = projectEffects(rooted.model, boundary, rooted.rootActivityId);
    assert.ok(effects.ok, JSON.stringify(effects));
    // The broadcast effect is visible at every level; directed effects appear
    // once the boundary separates source and target (same rule as the sample).
    assert.ok(effects.effects.length >= 1);
  }
});
