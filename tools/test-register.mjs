import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      specifier.endsWith(".js") &&
      context.parentURL
    ) {
      const tsSpecifier = specifier.slice(0, -3) + ".ts";
      const tsPath = new URL(tsSpecifier, context.parentURL);
      if (existsSync(fileURLToPath(tsPath))) {
        return nextResolve(tsSpecifier, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
