const STORAGE_KEY = "responsible.importedModels.v1";

export type StoredImportedModel = Readonly<{
  id: string;
  title: string;
  json: string;
  importedAt: number;
}>;

function isStoredImportedModel(value: unknown): value is StoredImportedModel {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["id"] === "string" &&
    typeof record["title"] === "string" &&
    typeof record["json"] === "string" &&
    typeof record["importedAt"] === "number"
  );
}

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
 * Reads persisted imported models, silently discarding anything that fails to
 * parse or no longer matches the expected shape.
 */
export function loadStoredImportedModels(): readonly StoredImportedModel[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredImportedModel);
  } catch {
    return [];
  }
}

function persist(models: readonly StoredImportedModel[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(models));
  } catch {
    // Quota exceeded or storage disabled — persistence is best-effort.
  }
}

/**
 * Adds or replaces (by id) a persisted imported model.
 */
export function addStoredImportedModel(model: StoredImportedModel): void {
  const existing = loadStoredImportedModels().filter((item) => item.id !== model.id);
  persist([...existing, model]);
}

export function removeStoredImportedModel(id: string): void {
  persist(loadStoredImportedModels().filter((item) => item.id !== id));
}
