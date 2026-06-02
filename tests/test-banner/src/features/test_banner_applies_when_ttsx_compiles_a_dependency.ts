import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "../internal/plugin-cache";

/**
 * Verifies the @ttsc/banner plugin runs when `ttsx` compiles a raw-`.ts`
 * dependency, not only the entry project.
 *
 * `ttsx` serves a dependency's `.ts` by compiling its owning package with the
 * real compiler — plugins included — rather than plain type-stripping, so a
 * transform/output plugin the dependency configures must shape that emit too.
 * Here `@ttsc/banner` is auto-discovered from the dependency's `package.json` +
 * `banner.config`; a regression that reduced the dependency build to a
 * type-strip would silently drop the banner, so this pins it.
 *
 * 1. Create an ESM project plus a symlinked `dep` package that lists
 *    `@ttsc/banner`, ships a `banner.config.cjs`, its own `tsconfig`, and raw
 *    `.ts`.
 * 2. Run `ttsx` against an entry importing the dependency.
 * 3. Assert the dependency executed and its emitted JavaScript carries the banner.
 */
export const test_banner_applies_when_ttsx_compiles_a_dependency = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ type: "module", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "nodenext",
        moduleResolution: "nodenext",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "packages/dep/package.json": JSON.stringify({
      name: "dep",
      version: "1.0.0",
      type: "module",
      exports: { ".": "./src/index.ts" },
      dependencies: { "@ttsc/banner": "*" },
    }),
    "packages/dep/banner.config.cjs": `module.exports = { text: "dependency banner" };\n`,
    "packages/dep/tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "nodenext",
        moduleResolution: "nodenext",
        strict: true,
        outDir: "lib",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "packages/dep/src/index.ts": `export const greet = (): string => "from-dep";\n`,
    "src/main.ts": `import { greet } from "dep";\nconsole.log(greet());\n`,
  });
  TestBanner.seedPackage(root);
  fs.symlinkSync(
    path.join(root, "packages", "dep"),
    path.join(root, "node_modules", "dep"),
    "junction",
  );

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    {
      cwd: root,
      env: {
        PATH: TestBanner.goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "from-dep");

  const emitted = findCompiledDependencyEntry(
    path.join(root, "packages", "dep"),
  );
  assert.notEqual(
    emitted,
    null,
    "the dependency package was compiled into its per-package cache",
  );
  TestBanner.assertSingleBanner(
    fs.readFileSync(emitted!, "utf8"),
    "dependency banner",
  );
};

/** Locate the `index.js` `ttsx` emitted for a compiled dependency package. */
function findCompiledDependencyEntry(packageRoot: string): string | null {
  const stack = [
    path.join(packageRoot, "node_modules", ".cache", "ttsc", "ttsx-deps"),
  ];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.isFile() && entry.name === "index.js") {
        return next;
      }
    }
  }
  return null;
}
