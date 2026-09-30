import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestStrip } from "../../internal/TestStrip";
import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies the @ttsc/strip plugin: package ttsc.plugin walks to ancestor
 * package.json.
 *
 * The strip auto-discovery path looks for `@ttsc/strip` in the nearest
 * `package.json`, but in a monorepo the sub-package tsconfig often lives in
 * `packages/app/` while the root `package.json` is two directories up. The
 * plugin loader must walk ancestor directories to find the root manifest,
 * otherwise monorepo users are forced to duplicate the dependency in every
 * sub-package.
 *
 * 1. Create a monorepo-shaped project: root `package.json` with `@ttsc/strip`,
 *    sub-package at `packages/app/` with its own `tsconfig.json` but no
 *    `package.json`.
 * 2. Run `ttsc --emit` from the sub-package working directory.
 * 3. Assert zero exit and that `console.log` and `debugger` are absent from the
 *    emitted `.js` output.
 *
 * @evidence contracts/testing.md#behavioral-verification An app with no local package manifest must emit kept while removing console.log and debugger using the ancestor dependency.
 * @evidence contracts/testing.md#independent-expectations The upward package-discovery contract gives the authored ancestor manifest ownership of the app plugin.
 * @evidence contracts/testing.md#distinguishing-cases The manifest is two levels above cwd and tsconfig, distinguishing local-only discovery from a genuine ancestor walk.
 * @evidence contracts/testing.md#execution-ownership This named test_strip_package_auto_plugin_walks_to_ancestor_package_json entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Host dependency discovery must carry ancestor registration into the nested consumer native compilation.
 * @evidence contracts/e2e.md#shared-execution The nested cwd and missing local manifest require this project load separately from package-root auto registration. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage An app with no local package manifest must emit kept while removing console.log and debugger using the ancestor dependency. All original assertions remain in this named entry. TestLinkedProgramStripsDefaultStatementsAndPreservesDeclarations and TestLinkedProgramStripsCustomCallsOnlyInStatementPositions own AST list/body/callee/value-position distinctions; this case retains its original configuration or published-output boundary.
 */
export function test_strip_package_auto_plugin_walks_to_ancestor_package_json() {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        dependencies: { "@ttsc/strip": "*" },
      }),
      "packages/app/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "packages/app/src/main.ts": [
        `console.log("drop-log");`,
        `debugger;`,
        `export const value = "kept";`,
        ``,
      ].join("\n"),
    });
    TestStrip.seedPackage(root);

    const project = path.join(root, "packages", "app");
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", project, "--emit"],
      {
        cwd: project,
        env: {
          PATH: TestStrip.goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const js = fs.readFileSync(path.join(project, "dist", "main.js"), "utf8");
    assert.match(js, /kept/);
    assert.doesNotMatch(js, /console\.log|\bdebugger\b/);
}
