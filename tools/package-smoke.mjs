import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = mkdtempSync(path.join(root, ".responsible-package-"));

try {
  execFileSync("pnpm", ["pack", "--pack-destination", temp], {
    cwd: root,
    stdio: "inherit",
  });

  const tarballName = readdirSync(temp).find((entry) => entry.endsWith(".tgz"));
  if (!tarballName) throw new Error("pnpm pack did not produce a tarball");
  const tarball = path.join(temp, tarballName);
  const installDir = path.join(temp, "install");
  mkdirSync(installDir);
  writeFileSync(
    path.join(installDir, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: { "@f4ah6o/responsible": `file:${tarball}` },
    }),
  );

  execFileSync("pnpm", ["install", "--ignore-scripts", "--no-frozen-lockfile"], {
    cwd: installDir,
    stdio: "inherit",
  });

  const packageDir = path.join(installDir, "node_modules", "@f4ah6o", "responsible");
  for (const file of ["dist-lib/index.d.ts", "dist-lib/cli.js"]) {
    if (!existsSync(path.join(packageDir, file)))
      throw new Error(`packed package is missing ${file}`);
  }

  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'const pkg = await import("@f4ah6o/responsible"); if (typeof pkg.validateProcessModel !== "function" || typeof pkg.analyzeProcessModel !== "function") process.exit(1);',
    ],
    { cwd: installDir, stdio: "inherit" },
  );

  const bin = path.join(installDir, "node_modules", ".bin", "responsible");
  execFileSync(bin, ["--help"], { cwd: installDir, stdio: "inherit" });
  const capabilities = JSON.parse(
    execFileSync(bin, ["capabilities", "--compact"], { cwd: installDir, encoding: "utf8" }),
  );
  if (capabilities.protocolVersion !== "responsible.cli.v1") {
    throw new Error("packed CLI returned an unexpected capabilities protocol");
  }
  execFileSync(bin, ["validate", path.join(root, "examples", "order-fulfillment.json")], {
    cwd: installDir,
    stdio: "inherit",
  });
  const analysis = JSON.parse(
    execFileSync(
      bin,
      ["analyze", path.join(root, "examples", "application-approval.v1.json"), "--compact"],
      { cwd: installDir, encoding: "utf8" },
    ),
  );
  if (!analysis.summary || !analysis.semantics || !analysis.automation) {
    throw new Error("packed CLI analyze output is incomplete");
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
