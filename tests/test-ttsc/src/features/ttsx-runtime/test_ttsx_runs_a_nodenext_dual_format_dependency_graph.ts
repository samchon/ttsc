import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx serves a NodeNext consumer whose raw `.ts` dependency graph
 * mixes both module formats at once: a CommonJS package and an ES-module
 * package, resolved through `module: "nodenext"` /
 * `moduleResolution: "nodenext"`.
 *
 * The existing dependency-runtime tests cover CommonJS, ESM, `.mts`, and `.cts`
 * in isolation, but never a single NodeNext build that pulls a CJS and an ESM
 * dependency into one graph. Under NodeNext each served file's emit format is
 * decided per file by its extension and the owning package `type`, so ttsx must
 * lower the `.cts` dependency to CommonJS (its `export =` becomes
 * `module.exports`) while keeping the `type: "module"` dependency as ESM, then
 * bridge the CJS module into the ESM consumer through Node's default-import
 * interop. A single wrong per-file format classification breaks one half of the
 * graph at load time.
 *
 * 1. Install a CommonJS `cjs-dep` whose `.cts` entry uses `export =`.
 * 2. Install an ESM `esm-dep` (`type: "module"`) with a named export.
 * 3. Run ttsx against a NodeNext ESM entry importing both.
 * 4. Assert both dependency formats executed and produced their values.
 */
export const test_ttsx_runs_a_nodenext_dual_format_dependency_graph = () => {
  const root = TestProject.createProject({
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
    // NodeNext, and `export =` must lower to `module.exports`.
    "node_modules/cjs-dep/package.json": JSON.stringify({
      name: "cjs-dep",
      version: "1.0.0",
      exports: { ".": "./index.cts" },
    }),
    "node_modules/cjs-dep/index.cts":
      "const api = {\n" +
      "  answer: 42 as number,\n" +
      "  echo: (n: number): number => n,\n" +
      "};\n" +
      "export = api;\n",
    // ESM dependency: `type: module` => ES module. Plain named export.
    "node_modules/esm-dep/package.json": JSON.stringify({
      name: "esm-dep",
      version: "1.0.0",
      type: "module",
      exports: { ".": "./index.ts" },
    }),
    "node_modules/esm-dep/index.ts":
      `export const greet = (): string => "esm-ok";\n`,
    // NodeNext ESM entry pulling both formats into one graph. The CommonJS
    // dependency comes in through Node's default-import interop; the ESM
    // dependency uses a named import.
    "src/main.ts":
      `import cjs from "cjs-dep";\n` +
      `import { greet } from "esm-dep";\n` +
      "console.log(`${cjs.answer}:${cjs.echo(7)}:${greet()}`);\n",
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "42:7:esm-ok");
};
