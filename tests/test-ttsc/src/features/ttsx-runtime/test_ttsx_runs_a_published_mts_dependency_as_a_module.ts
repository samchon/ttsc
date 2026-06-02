import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx loads a published raw `.mts` dependency as a module.
 *
 * Tsgo emits a `.mts` source as `.mjs`, which Node always loads as an ES module
 * regardless of the package `type`. This pins that the extension wins for a
 * `.mts` source shipped under `node_modules` with no `type` field.
 *
 * 1. Install a published `mts-dep` (no `type` field) whose entry is `index.mts`.
 * 2. Run ttsx against an entry importing it.
 * 3. Assert the `.mts` dependency executed as ESM.
 */
export const test_ttsx_runs_a_published_mts_dependency_as_a_module = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ type: "module", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ES2022",
        moduleResolution: "bundler",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "node_modules/mts-dep/package.json": JSON.stringify({
      name: "mts-dep",
      version: "1.0.0",
      exports: { ".": "./index.mts" },
    }),
    "node_modules/mts-dep/index.mts": `export const fromMts = (): string => "mts-module";\n`,
    "src/main.ts": `import { fromMts } from "mts-dep";\nconsole.log(fromMts());\n`,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "mts-module");
};
