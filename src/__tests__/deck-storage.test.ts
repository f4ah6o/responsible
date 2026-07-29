import { test } from "node:test";
import assert from "node:assert/strict";

import {
  clearStoredDeck,
  loadStoredDeck,
  saveStoredDeck,
} from "../viewer/authoring/deckStorage.js";
import {
  addCard,
  createCard,
  emptyDeck,
  updateCard,
  validateCardDeck,
} from "../viewer/authoring/cardDeck.js";
import { sampleDeck } from "../viewer/authoring/sampleDeck.js";

const STORAGE_KEY = "responsible.authoring.deck.v1";

function installMockLocalStorage(): void {
  const store = new Map<string, string>();
  const mock: Storage = {
    getItem: (key) => (store.has(key) ? (store.get(key) ?? null) : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: mock,
    writable: true,
    configurable: true,
  });
}

function removeGlobalLocalStorage(): void {
  Object.defineProperty(globalThis, "localStorage", {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

test("deck storage is a silent no-op when localStorage is unavailable", () => {
  removeGlobalLocalStorage();
  assert.equal(loadStoredDeck(), undefined);
  saveStoredDeck(emptyDeck());
  clearStoredDeck();
});

test("save / load / clear round-trip through localStorage", () => {
  installMockLocalStorage();
  assert.equal(loadStoredDeck(), undefined);

  const deck = sampleDeck();
  saveStoredDeck(deck);
  assert.deepEqual(loadStoredDeck(), deck);

  clearStoredDeck();
  assert.equal(loadStoredDeck(), undefined);
});

test("reload preserves a draft with an unfinished Decision outcome", () => {
  installMockLocalStorage();
  let deck = emptyDeck();
  deck = addCard(deck, createCard(deck, "decision", { x: 0, y: 0 }));
  deck = updateCard(deck, "decision-1", { outcomes: ["approved", "rejected", ""] });

  saveStoredDeck(deck);
  const restored = loadStoredDeck();

  assert.ok(restored);
  assert.equal(restored.cards.length, 1);
  assert.deepEqual(restored.cards[0]?.outcomes, ["approved", "rejected", ""]);
  assert.equal(
    validateCardDeck(restored).some((issue) => issue.path.endsWith("outcomes[2]")),
    true,
  );
  clearStoredDeck();
});

test("loadStoredDeck tolerates corrupted JSON in storage", () => {
  installMockLocalStorage();
  localStorage.setItem(STORAGE_KEY, "{not json");
  assert.equal(loadStoredDeck(), undefined);
});

test("loadStoredDeck discards a deck that no longer matches the schema", () => {
  installMockLocalStorage();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: "responsible.card-deck.v0", title: "old", cards: [] }),
  );
  assert.equal(loadStoredDeck(), undefined);
});
