import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../../internal/TestUtilityPlugins";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

/**
 * Verifies ttsc utility plugins: forced emit confines output to outDir.
 *
 * Locks the outputEscapesOutDir guard in the native utility host's emit lane
 * (issue #293). A project nested inside a dependency package's directory
 * resolves the dependency's name by package self-reference — no node_modules
 * hop — so the dependency's raw `.ts` sources are not external-library files
 * and stay in the forced-emit set. Their output paths resolve outside the
 * project's `outDir`, right next to the dependency's own sources; without the
 * guard every plugin `--emit` build pollutes the dependency's source tree with
 * stray `.js` files.
 *
 * 1. Materialize a dependency package whose `exports` points at raw `.ts`, with a
 *    plugin-configured project nested inside the package directory.
 * 2. Run `ttsc --emit` so the build routes through the native utility host.
 * 3. Assert the project's own `dist/main.js` was emitted.
 * 4. Assert no `.js` was written into the dependency's `src/` tree.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual forced native emission must publish the banner-bearing project output and leave the self-referenced dependency source tree free of JavaScript.
 * @evidence contracts/testing.md#independent-expectations The explicit raw-TypeScript package self-reference places dependency sources outside project outDir; the literal confined marker and empty leaked-.js list independently establish correct scope.
 * @evidence contracts/testing.md#distinguishing-cases Owns nested project/package self-reference that bypasses node_modules and a dependency output-negative control; ordinary utility composition has a different in-project output layout.
 * @evidence contracts/testing.md#execution-ownership The matching named utility export runs actual ttsc and linked banner host publication in the shared Linux native batch.
 * @evidence contracts/e2e.md#necessary-boundary The real compiler emits dependency candidates and the utility host must filter publication outside outDir; direct path predicate or banner semantics units cannot prove the publisher connection.
 * @evidence contracts/e2e.md#shared-execution The immutable banner producer shares the batch plugin cache and Go objects with the two banner ttsx boundary cases; only the nested consumer layout changes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The project and dependency own separate source/output paths within one isolated fixture; native artifact identity excludes consumer layout, and no shared producer source or cache is mutated.
 * @evidence contracts/e2e.md#preserved-coverage Original successful status, confined banner in actual main.js and exact empty dependency JavaScript leak list remain. This case does not claim all path confinement semantics are native-only.
 */
export function test_ttsc_utility_plugins_forced_emit_confines_output_to_outdir(): void {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({
      name: "selfdep",
      version: "1.0.0",
      exports: { ".": "./src/index.ts" },
    }),
    "src/index.ts": `export const dep: number = 1;\n`,
    "proj/banner.config.cjs": `module.exports = { text: "confined" };\n`,
    "proj/tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "CommonJS",
        moduleResolution: "bundler",
        target: "ES2022",
        strict: true,
        skipLibCheck: true,
        rootDir: "src",
        outDir: "dist",
        plugins: [
          {
            transform: "@ttsc/banner",
            configFile: "banner.config.cjs",
          },
        ],
      },
      include: ["src"],
    }),
    "proj/src/main.ts": [
      `import { dep } from "selfdep";`,
      `export const x: number = dep;`,
      ``,
    ].join("\n"),
  });
  TestUtilityPlugins.seedPackages(root, ["banner"]);
  const project = path.join(root, "proj");
  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", project, "--emit"],
    {
      cwd: project,
      env: {
        PATH: TestUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const mainJs = fs.readFileSync(
    path.join(project, "dist", "main.js"),
    "utf8",
  );
  assert.match(mainJs, /confined/);
  const leaked = fs
    .readdirSync(path.join(root, "src"), { recursive: true })
    .map(String)
    .filter((file) => file.endsWith(".js"));
  assert.deepEqual(
    leaked,
    [],
    `dependency source tree was polluted: ${leaked.join(", ")}`,
  );
}
