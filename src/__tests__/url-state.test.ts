/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  decodeModelParam,
  encodeModelParam,
  readViewerUrlState,
  writeViewerUrlState,
} from "../viewer/urlState.js";

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

test("readViewerUrlState parses m= as modelParam", () => {
  const state = readViewerUrlState("#m=abc123&z=2&s=root,child");
  assert.equal(state.modelParam, "abc123");
  assert.equal(state.zoomLevel, 2);
  assert.deepEqual(state.scopePath, ["root", "child"]);
});

test("writeViewerUrlState embeds modelParam as m= in place of p=", () => {
  const hash = writeViewerUrlState({
    processId: "ignored-when-modelParam-is-present",
    zoomLevel: 2,
    scopePath: ["root", "child"],
    modelParam: "abc123",
  });
  assert.equal(hash, "#m=abc123&z=2&s=root%2Cchild");
});

test("encodeModelParam / decodeModelParam round-trip the bundled example models", async () => {
  const fixtures = [
    "../../examples/order-fulfillment.json",
    "../../examples/application-approval.v1.json",
  ];
  for (const path of fixtures) {
    const json = readFileSync(new URL(path, import.meta.url), "utf8");
    const encoded = await encodeModelParam(json);
    const decoded = await decodeModelParam(encoded);
    assert.deepEqual(JSON.parse(decoded), JSON.parse(json));
  }
});

test("decodeModelParam rejects a value that is not valid base64url", async () => {
  await assert.rejects(() => decodeModelParam("not valid base64url!!"));
});

test("decodeModelParam rejects base64url that does not decode as deflate-raw", async () => {
  const bogus = btoa("plainly not compressed")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  await assert.rejects(() => decodeModelParam(bogus));
});

test("a decoded payload that is not valid JSON still round-trips as text", async () => {
  const encoded = await encodeModelParam("{ this is not json");
  const decoded = await decodeModelParam(encoded);
  assert.equal(decoded, "{ this is not json");
  assert.throws(() => JSON.parse(decoded));
});
