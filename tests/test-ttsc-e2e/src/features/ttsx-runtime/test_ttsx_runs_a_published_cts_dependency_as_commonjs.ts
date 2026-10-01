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
 * @evidence contracts/testing.md#behavioral-verification Runs an ESM bundler-option consumer importing a published CTS dependency with export assignment and requires cts-commonjs.
 * @evidence contracts/testing.md#independent-expectations The authored export-assigned literal independently determines the runtime default-import value.
 * @evidence contracts/testing.md#distinguishing-cases CTS export assignment must retain CommonJS semantics under an ESM consumer; this differs from ordinary named CommonJS exports.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_runs_a_published_cts_dependency_as_commonjs at this path, selected by tests/test-scripts-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Actual native CTS emission and Node default-import interoperation connect the published package boundary.
 * @evidence contracts/e2e.md#shared-execution One package graph and one host reuse the installed compiler; no per-case plugin build or installation is required.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Immutable package/config inputs belong to the tracked temporary project for the child and process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The exact CTS value stays in this export-assignment boundary entry; classification units do not execute that interoperation.
 */
export function test_ttsx_runs_a_published_cts_dependency_as_commonjs() {
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
}
