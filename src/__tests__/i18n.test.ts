import { test } from "node:test";
import assert from "node:assert/strict";

import { detectInitialLocale, messageKeys, translate } from "../viewer/i18n.js";

test("ja and en dictionaries cover the same keys with non-empty values", () => {
  for (const key of messageKeys()) {
    assert.notEqual(translate("ja", key), "");
    assert.notEqual(translate("en", key), "");
  }
});

test("translate substitutes placeholders", () => {
  assert.equal(
    translate("en", "importError", { fileName: "foo.json", issues: "bad" }),
    "Could not load foo.json — bad",
  );
  assert.equal(
    translate("ja", "importError", { fileName: "foo.json", issues: "bad" }),
    "foo.json を読み込めませんでした — bad",
  );
  assert.equal(translate("en", "boundaryZoomLevel", { ordinal: 2, total: 5 }), "Level 2/5");
});

test("translate leaves templates without params untouched", () => {
  assert.equal(translate("en", "reload"), "Reload");
  assert.equal(translate("ja", "reload"), "再読み込み");
});

test("translate ignores unknown placeholder names", () => {
  assert.equal(
    translate("en", "importError", { fileName: "x", issues: "y", extra: "z" }),
    "Could not load x — y",
  );
});

test("detectInitialLocale falls back to en without window/localStorage/navigator", () => {
  assert.equal(detectInitialLocale(), "en");
});
