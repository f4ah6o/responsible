export type ViewerUrlState = Readonly<{
  processId?: string;
  zoomLevel?: number;
  scopePath?: readonly string[];
  modelParam?: string;
}>;

/**
 * Parses viewer state from a URL hash (`#p=<processId>&z=<level>&s=<id,id>`,
 * or `#m=<compressed-model>&z=<level>&s=<id,id>` for an embedded model).
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
    modelParam?: string;
  } = {};

  const modelParam = params.get("m");
  if (modelParam) state.modelParam = modelParam;

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
 * is omitted while it only contains the root (the default view). When
 * `modelParam` is given, it is embedded as `#m=` in place of `#p=` so the
 * link carries the model itself rather than just a bundled-sample reference.
 */
export function writeViewerUrlState(
  state: Readonly<{
    processId: string;
    zoomLevel: number;
    scopePath: readonly string[];
    modelParam?: string;
  }>,
): string {
  const params = new URLSearchParams();
  if (state.modelParam) {
    params.set("m", state.modelParam);
  } else {
    params.set("p", state.processId);
  }
  params.set("z", String(state.zoomLevel));
  if (state.scopePath.length > 1) params.set("s", state.scopePath.join(","));
  return `#${params.toString()}`;
}

function collectStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return (async () => {
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  })();
}

function bytesToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const restored = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = restored.length % 4 === 0 ? "" : "=".repeat(4 - (restored.length % 4));
  const binary = atob(restored + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Compresses a JSON model string (`deflate-raw`) and encodes it as base64url
 * for embedding in a `#m=` URL hash parameter.
 */
export async function encodeModelParam(json: string): Promise<string> {
  const transform = new CompressionStream("deflate-raw") as unknown as ReadableWritablePair<
    Uint8Array,
    Uint8Array
  >;
  const compressed = bytesToStream(new TextEncoder().encode(json)).pipeThrough(transform);
  return bytesToBase64Url(await collectStream(compressed));
}

/**
 * Reverses `encodeModelParam`. Throws (base64 decode error or invalid
 * deflate-raw stream) when `param` is not a value this module produced;
 * callers should treat that as an unrecoverable, user-facing error.
 */
export async function decodeModelParam(param: string): Promise<string> {
  const transform = new DecompressionStream("deflate-raw") as unknown as ReadableWritablePair<
    Uint8Array,
    Uint8Array
  >;
  const decompressed = bytesToStream(base64UrlToBytes(param)).pipeThrough(transform);
  return new TextDecoder().decode(await collectStream(decompressed));
}
