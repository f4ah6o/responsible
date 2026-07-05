export type ViewerUrlState = Readonly<{
  processId?: string;
  zoomLevel?: number;
  scopePath?: readonly string[];
}>;

/**
 * Parses viewer state from a URL hash (`#p=<processId>&z=<level>&s=<id,id>`).
 * Unknown or malformed parameters are ignored; callers re-validate the values
 * against the actual model before applying them.
 */
export function readViewerUrlState(hash: string): ViewerUrlState {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return {};

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return {};
  }

  const state: {
    processId?: string;
    zoomLevel?: number;
    scopePath?: readonly string[];
  } = {};

  const processId = params.get("p");
  if (processId) state.processId = processId;

  const zoom = params.get("z");
  if (zoom !== null && /^\d+$/.test(zoom)) state.zoomLevel = Number(zoom);

  const scope = params.get("s");
  if (scope) {
    const path = scope.split(",").filter((id) => id.length > 0);
    if (path.length > 0) state.scopePath = path;
  }

  return state;
}

/**
 * Serializes viewer state into a URL hash for shareable links. The scope path
 * is omitted while it only contains the root (the default view).
 */
export function writeViewerUrlState(
  state: Readonly<{
    processId: string;
    zoomLevel: number;
    scopePath: readonly string[];
  }>,
): string {
  const params = new URLSearchParams();
  params.set("p", state.processId);
  params.set("z", String(state.zoomLevel));
  if (state.scopePath.length > 1) params.set("s", state.scopePath.join(","));
  return `#${params.toString()}`;
}
