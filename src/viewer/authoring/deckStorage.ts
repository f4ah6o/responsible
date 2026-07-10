import { parseCardDeck, type CardDeck } from "./cardDeck.js";

const STORAGE_KEY = "responsible.authoring.deck.v1";

// Wrapped in try/catch: localStorage can throw (private-mode Safari) or be
// absent entirely (this module also loads under plain Node for tests).
function getStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Restores the draft deck, or `undefined` when nothing usable is stored —
 * corrupted JSON and shape mismatches are discarded silently so a schema
 * change can never wedge the authoring mode.
 */
export function loadStoredDeck(): CardDeck | undefined {
  const storage = getStorage();
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return parseCardDeck(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function saveStoredDeck(deck: CardDeck): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(deck));
  } catch {
    // Quota exceeded or storage disabled — persistence is best-effort.
  }
}

export function clearStoredDeck(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — the draft just stays around.
  }
}
