import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extractChangelogSection } from "../../tools/extract-changelog.mjs";

const sample = `# Changes

## Unreleased

### Added

### Changed

## 0.2.0 - 2026-08-01

### Added

- Second release feature.

## 0.1.0 - 2026-07-08

### Added

- First release feature.
- Another line.

### Fixed

- A bug fix.
`;

test("extracts a middle section up to the next heading", () => {
  const section = extractChangelogSection(sample, "0.2.0");
  assert.equal(section, "### Added\n\n- Second release feature.");
});

test("extracts the last section through EOF", () => {
  const section = extractChangelogSection(sample, "0.1.0");
  assert.equal(
    section,
    "### Added\n\n- First release feature.\n- Another line.\n\n### Fixed\n\n- A bug fix.",
  );
});

test("returns only headings for a section with no entries", () => {
  const section = extractChangelogSection(sample, "Unreleased");
  assert.equal(section, "### Added\n\n### Changed");
});

test("returns null for a version with no matching heading", () => {
  const section = extractChangelogSection(sample, "9.9.9");
  assert.equal(section, null);
});

test("does not match a version that is a prefix of another heading", () => {
  const section = extractChangelogSection(sample, "0.1");
  assert.equal(section, null);
});

test("real CHANGES.md has a non-empty 0.1.0 section", () => {
  const changesMd = readFileSync(
    fileURLToPath(new URL("../../CHANGES.md", import.meta.url)),
    "utf8",
  );
  const section = extractChangelogSection(changesMd, "0.1.0");
  assert.ok(section && section.length > 0);
});
