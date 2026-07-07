import { test } from "node:test";
import assert from "node:assert/strict";

import { buildExportFileName } from "../viewer/exportImage.js";

test("buildExportFileName joins process name and boundary label", () => {
  assert.equal(buildExportFileName("見積承認", "会社", "svg"), "見積承認-会社.svg");
  assert.equal(
    buildExportFileName("Order Fulfillment", "team", "png"),
    "Order-Fulfillment-team.png",
  );
});

test("buildExportFileName replaces filesystem-unsafe characters", () => {
  assert.equal(buildExportFileName("A/B:C*D", "x?y", "svg"), "A-B-C-D-x-y.svg");
});

test("buildExportFileName collapses repeated separators and trims edges", () => {
  assert.equal(buildExportFileName("  spaced   name  ", "lvl", "png"), "spaced-name-lvl.png");
});

test("buildExportFileName falls back to a placeholder for empty parts", () => {
  assert.equal(buildExportFileName("", "", "svg"), "untitled-untitled.svg");
});
