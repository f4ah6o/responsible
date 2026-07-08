// Extracts a single version section from CHANGES.md, from its `## <version>`
// heading up to (but not including) the next `## ` heading or EOF. Used by
// .github/workflows/release.yml to build GitHub Release notes.
import { readFileSync } from "node:fs";

export function extractChangelogSection(changesMd, version) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingPattern = new RegExp(`^## ${escaped}(?:\\s|$)`);
  const lines = changesMd.split("\n");

  const startIndex = lines.findIndex((line) => headingPattern.test(line));
  if (startIndex === -1) return null;

  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      endIndex = i;
      break;
    }
  }

  return lines
    .slice(startIndex + 1, endIndex)
    .join("\n")
    .trim();
}

function main() {
  const version = process.argv[2];
  if (!version) {
    console.error("Usage: node tools/extract-changelog.mjs <version>");
    process.exit(1);
  }

  const changesMd = readFileSync(new URL("../CHANGES.md", import.meta.url), "utf8");
  const section = extractChangelogSection(changesMd, version);
  if (section === null) {
    console.error(`No CHANGES.md section found for version "${version}"`);
    process.exit(1);
  }
  if (section === "") {
    console.error(`CHANGES.md section for version "${version}" is empty`);
    process.exit(1);
  }

  process.stdout.write(section + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
