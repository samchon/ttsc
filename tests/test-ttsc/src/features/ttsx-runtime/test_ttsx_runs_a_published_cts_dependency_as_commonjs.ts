import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx loads a published raw `.cts` dependency as CommonJS.
 *
 * The `load` hook treats `.cts` as authoritatively CommonJS, the counterpart to
 * the `.mts` rule, and `transform` mode lowers a TypeScript `export =`
 * assignment into a CommonJS `module.exports`. This pins that an ESM consumer
 * can still import a published `.cts` source through Node's CommonJS interop.
 *
 * 1. Install a published `cts-dep` whose entry is `index.cts` using `export =`.
 * 2. Run ttsx against an ESM entry importing its default export.
 * 3. Assert the CommonJS dependency executed.
 */
export const test_ttsx_runs_a_published_cts_dependency_as_commonjs = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ type: "module", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ES2022",
        moduleResolution: "bundler",
        strict: true,
        esModuleInterop: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "node_modules/cts-dep/package.json": JSON.stringify({
      name: "cts-dep",
      version: "1.0.0",
      exports: { ".": "./index.cts" },
    }),
    "node_modules/cts-dep/index.cts": `const value: string = "cts-commonjs";\nexport = value;\n`,
    "src/main.ts": `import value from "cts-dep";\nconsole.log(value);\n`,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "cts-commonjs");
};
