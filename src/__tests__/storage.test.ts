import { test } from "node:test";
import assert from "node:assert/strict";

import {
  addStoredImportedModel,
  loadStoredImportedModels,
  removeStoredImportedModel,
} from "../viewer/storage.js";

const STORAGE_KEY = "responsible.importedModels.v1";

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

test("loadStoredImportedModels returns [] when localStorage is unavailable", () => {
  removeGlobalLocalStorage();
  assert.deepEqual(loadStoredImportedModels(), []);
  // Deleting/adding should also be a silent no-op rather than throw.
  addStoredImportedModel({ id: "a", title: "A", json: "{}", importedAt: 1 });
  removeStoredImportedModel("a");
});

test("add / load / remove round-trip through localStorage", () => {
  installMockLocalStorage();
  assert.deepEqual(loadStoredImportedModels(), []);

  addStoredImportedModel({ id: "a", title: "A", json: "{}", importedAt: 1 });
  addStoredImportedModel({ id: "b", title: "B", json: "{}", importedAt: 2 });
  assert.deepEqual(
    loadStoredImportedModels().map((model) => model.id),
    ["a", "b"],
  );

  removeStoredImportedModel("a");
  assert.deepEqual(
    loadStoredImportedModels().map((model) => model.id),
    ["b"],
  );
});

test("addStoredImportedModel replaces an existing entry with the same id", () => {
  installMockLocalStorage();
  addStoredImportedModel({ id: "a", title: "A", json: "{}", importedAt: 1 });
  addStoredImportedModel({ id: "a", title: "A2", json: "{}", importedAt: 2 });
  const models = loadStoredImportedModels();
  assert.equal(models.length, 1);
  assert.equal(models[0]?.title, "A2");
});

test("loadStoredImportedModels discards entries that no longer match the expected shape", () => {
  installMockLocalStorage();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([{ id: "ok", title: "T", json: "{}", importedAt: 1 }, { bogus: true }]),
  );
  assert.deepEqual(
    loadStoredImportedModels().map((model) => model.id),
    ["ok"],
  );
});

test("loadStoredImportedModels tolerates corrupted JSON in storage", () => {
  installMockLocalStorage();
  localStorage.setItem(STORAGE_KEY, "{not json");
  assert.deepEqual(loadStoredImportedModels(), []);
});
