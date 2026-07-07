// Copies schemas/*.schema.json (source of truth) into public/schemas/, so
// Vite ships them at dist/schemas/ and GitHub Pages serves them at
// https://f4ah6o.github.io/responsible/schemas/.
import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcDir = path.join(root, "schemas");
const destDir = path.join(root, "public", "schemas");

mkdirSync(destDir, { recursive: true });

for (const entry of readdirSync(srcDir)) {
  if (!entry.endsWith(".schema.json")) continue;
  cpSync(path.join(srcDir, entry), path.join(destDir, entry));
}
