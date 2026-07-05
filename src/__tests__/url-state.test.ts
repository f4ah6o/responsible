import { test } from "node:test";
import assert from "node:assert/strict";

import { readViewerUrlState, writeViewerUrlState } from "../viewer/urlState.js";

test("readViewerUrlState parses process, zoom, and scope", () => {
  const state = readViewerUrlState("#p=software_development&z=3&s=root,implementation_loop");
  assert.equal(state.processId, "software_development");
  assert.equal(state.zoomLevel, 3);
  assert.deepEqual(state.scopePath, ["root", "implementation_loop"]);
});

test("readViewerUrlState ignores empty or malformed hashes", () => {
  assert.deepEqual(readViewerUrlState(""), {});
  assert.deepEqual(readViewerUrlState("#"), {});
  assert.deepEqual(readViewerUrlState("#z=abc"), {});
  assert.deepEqual(readViewerUrlState("#s="), {});
});

test("writeViewerUrlState omits the scope path at root", () => {
  const hash = writeViewerUrlState({
    processId: "software_development",
    zoomLevel: 1,
    scopePath: ["software_development"],
  });
  assert.equal(hash, "#p=software_development&z=1");
});

test("write / read round-trips", () => {
  const hash = writeViewerUrlState({
    processId: "doc publishing",
    zoomLevel: 4,
    scopePath: ["root", "review"],
  });
  const state = readViewerUrlState(hash);
  assert.equal(state.processId, "doc publishing");
  assert.equal(state.zoomLevel, 4);
  assert.deepEqual(state.scopePath, ["root", "review"]);
});
