import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx serves a NodeNext consumer whose raw `.ts` dependency graph
 * mixes both module formats at once: a CommonJS package and an ES-module
 * package, resolved through `module: "nodenext"` / `moduleResolution:
 * "nodenext"`.
 *
 * The existing dependency-runtime tests cover CommonJS, ESM, `.mts`, and `.cts`
 * in isolation, but never a single NodeNext build that pulls a CJS and an ESM
 * dependency into one graph. Under NodeNext each served file's emit format is
 * decided per file by its extension and the owning package `type`, so ttsx must
 * lower the `.cts` dependency to CommonJS (its module-syntax `export const`
 * becomes `module.exports` assignments) while keeping the `type: "module"`
 * dependency as ESM, then bridge the CJS module into the ESM consumer through
 * Node's default-import interop. A single wrong per-file format classification
 * breaks one half of the graph at load time.
 *
 * 1. Install a CommonJS `cjs-dep` whose `.cts` entry uses module-syntax `export
 *    const` (ECMAScript syntax that must be lowered to CommonJS).
 * 2. Install an ESM `esm-dep` (`type: "module"`) with a named export.
 * 3. Run ttsx against a NodeNext ESM entry importing both.
 * 4. Assert both dependency formats executed and produced their values.
 * @evidence contracts/testing.md#behavioral-verification Runs an ESM consumer loading a CTS CommonJS dependency and a type-module TypeScript dependency, requiring 42:7:esm-ok.
 * @evidence contracts/testing.md#independent-expectations Authored dependency constants and functions independently establish the combined literal output.
 * @evidence contracts/testing.md#distinguishing-cases The same graph must support CommonJS and ESM formats together, including their export interoperation.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_runs_a_nodenext_dual_format_dependency_graph at this path, selected by tests/test-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary One actual native dependency graph and Node module loader exercise both format connections in one runtime.
 * @evidence contracts/e2e.md#shared-execution Both formats share one project, compiler preparation and runtime host. Consolidated selection writes this same original file map on the borrowed canonical root and uses its supplied guarded actual spawn; standalone selection retains its own allocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Package types and dependency sources remain immutable throughout the synchronous child; tracked project cleanup occurs at process exit.
 * @evidence contracts/e2e.md#preserved-coverage The exact combined output remains here and is not replaced by format-classification assertions alone.
 */
export function test_ttsx_runs_a_nodenext_dual_format_dependency_graph(
  prepared?: { root: string; spawn: typeof TestProject.spawn },
) {
  const files = {
    "package.json": JSON.stringify({ type: "module", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "nodenext",
        moduleResolution: "nodenext",
        strict: true,
        esModuleInterop: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    // CommonJS dependency: `.cts` entry is authoritatively CommonJS under
    // NodeNext, and its ECMAScript `export const` module syntax must lower to
    // `module.exports` assignments (a plain type-strip would leave the `export`
    // tokens and Node's CommonJS loader would throw `Unexpected token 'export'`).
    "node_modules/cjs-dep/package.json": JSON.stringify({
      name: "cjs-dep",
      version: "1.0.0",
      exports: { ".": "./index.cts" },
    }),
    "node_modules/cjs-dep/index.cts":
      "export const answer: number = 42;\n" +
      "export const echo = (n: number): number => n;\n",
    // ESM dependency: `type: module` => ES module. Plain named export.
    "node_modules/esm-dep/package.json": JSON.stringify({
      name: "esm-dep",
      version: "1.0.0",
      type: "module",
      exports: { ".": "./index.ts" },
    }),
    "node_modules/esm-dep/index.ts": `export const greet = (): string => "esm-ok";\n`,
    // NodeNext ESM entry pulling both formats into one graph. The CommonJS
    // dependency comes in through Node's default-import interop; the ESM
    // dependency uses a named import.
    "src/main.ts":
      `import cjs from "cjs-dep";\n` +
      `import { greet } from "esm-dep";\n` +
      "console.log(`${cjs.answer}:${cjs.echo(7)}:${greet()}`);\n",
  };
  const root = prepared?.root ?? TestProject.createProject(files);
  if (prepared) TestProject.writeFiles(root, files);

  const result = (prepared?.spawn ?? TestProject.spawn)(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "42:7:esm-ok");
}
