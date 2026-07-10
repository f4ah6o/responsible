# Card authoring layer

English | [日本語](card-authoring.ja.md)

This document describes the Magica-style card authoring mode added to the viewer ([issue #42](https://github.com/f4ah6o/responsible/issues/42)) and, above all, its layering rule:

> **The card UX is an authoring layer. The responsible core is the semantic layer.**

Cards are an input vocabulary for people who think in terms of business cards, not JSON. The canonical internal representation is unchanged: a `responsible.v1` `ProcessModel` (typed Activities, flows, responsibility boundaries). The card layer converts to it; it never extends it. No Magica-specific concept exists in `src/model.ts`, `src/validate.ts`, or the projection core.

Reference: [Magica](https://www.magicaland.org) — business flows written as cards anyone can lay out.

## Where things live

| Piece                                | Location                                               | Depends on                                              |
| ------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------- |
| Card deck types + operations         | `src/viewer/authoring/cardDeck.ts`                     | core types only (`ActivityStatus`, `EffectPayloadKind`) |
| Deck → model adapter                 | `src/viewer/authoring/deckToModel.ts`                  | `src/model.ts` types                                    |
| Draft persistence                    | `src/viewer/authoring/deckStorage.ts`                  | `localStorage` (`responsible.authoring.deck.v1`)        |
| Sample deck                          | `src/viewer/authoring/sampleDeck.ts`                   | —                                                       |
| Authoring UI                         | `src/viewer/authoring/*.tsx`                           | React, `@xyflow/react`                                  |
| Validation                           | **reused**: `validateProcessModel` (`src/validate.ts`) | —                                                       |
| Projection / boundary zoom / effects | **reused**: existing core and viewer                   | —                                                       |

The deck itself (`CardDeck`) is serializable authoring state: cards, connections, lane hints, and canvas positions. Canvas positions are never exported to the model.

## Card types → `responsible.v1`

| Card type                           | UI                                                                                                          | Converts to                                                                                                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Activity card**                   | node on the canvas                                                                                          | `ActivityDef` — `name` (title), `input`, `output`, `responsibility`, `status`, plus the v1 fields below                                                                        |
| **Decision card**                   | node on the canvas (dashed border), with an `outcomes` list                                                 | An ordinary `ActivityDef` whose `output` is a decision-result type. **Not a gateway** — the semantic core has none.                                                            |
| **Flow connection**                 | edge drawn between cards                                                                                    | `FlowDef { from, to, mapping?, contract? }`. A connection leaving a Decision card with outcome `approved` emits `mapping: "when output = approved"`; an explicit mapping wins. |
| **Responsibility card** (lane hint) | reusable preset in the palette, applied to the selected card; also the five axis fields in the detail panel | `activity.responsibility` (only non-empty axes are emitted)                                                                                                                    |
| **Condition card**                  | requires / ensures fact lists on the selected card                                                          | `activity.requires` / `activity.ensures` (`FactRef[]`)                                                                                                                         |
| **Effect card**                     | effect sub-cards on the selected card                                                                       | `activity.effects` (`EffectDef[]`; a `directed` delivery carries the non-empty target axes as a `Responsibility`)                                                              |

Group / decomposition cards and Document (model `types`) cards are out of the initial scope; the generated model is flat, and the viewer's existing `ensureRootActivity` wraps it in a synthetic root on import — exactly as it does for a flat JSON file.

## Data flow

```text
Card deck (authoring state, localStorage draft)
        │  deckToProcessModel (pure, never throws)
        ▼
responsible.v1 JSON  ──►  validateProcessModel (live status in the authoring screen)
        │  "Open in viewer" = the same path as "Load JSON"
        ▼
parseProcessModelJson → ensureRootActivity → localStorage import list → viewer
        ▼
projection / RBNF / boundary zoom / drill-down / effects / share links (unchanged)
```

Structural problems (blank input/output, missing endpoints, an empty deck) are not prevented by the adapter — they surface as JSON-path issues from the existing validator, and “Open in viewer” / “Export JSON” stay disabled until the model validates.

## Card ids

Card ids are generated once at creation (`activity-1`, `decision-2`, …), never change on rename, and become the Activity ids of the generated model. Connection ids (`flow-n`) exist only in the deck; `FlowDef` entries are emitted without ids.

## Acceptance (issue #42)

- A small process can be built from the card UI alone and exported / re-imported as `responsible.v1`.
- The bundled `application_approval` v1 sample is reproduced by the built-in sample deck; `src/__tests__/card-authoring.test.ts` asserts the generated model deep-matches the sample's leaf activities and flows, passes `validateProcessModel`, and projects (including `projectEffects`) at every boundary zoom level.
- JSON authoring and the loader stay first-class; the card mode is an additional entry point, not a replacement.

## Non-goals

- No re-implementation of Magica itself.
- No changes to the semantic core to fit the card structure.
- No pivot toward BPMN / RACI / state-machine tooling.
- No reverse adapter (model → cards) in the initial scope: the card mode authors new decks; existing JSON models are viewed, not decompiled into cards.
