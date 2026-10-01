import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestStrip } from "../../../internal/TestStrip";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

/**
 * Verifies the @ttsc/strip plugin: honors an explicit configFile path from the
 * tsconfig plugin entry.
 *
 * Locks the configFile resolution path in loadStripConfigMap: when the tsconfig
 * plugin entry contains a "configFile" key, the driver must resolve the path
 * relative to the tsconfig directory and load configuration from that file
 * instead of running auto-discovery.
 *
 * 1. Create a project with a custom config file at a non-default path
 *    (`config/my-strip.json`) and a tsconfig plugin entry that references it
 *    via `configFile`.
 * 2. Run `ttsc --emit`.
 * 3. Assert that only the calls listed in the custom file are stripped and that
 *    the default strip targets (console.log, console.debug) are not stripped.
 *
 * @evidence contracts/testing.md#behavioral-verification The nondefault config/my-strip.json must remove console.warn and retain console.log(keep-log).
 * @evidence contracts/testing.md#independent-expectations The literal custom calls list defines the changed callee and independently retained default callee.
 * @evidence contracts/testing.md#distinguishing-cases A nondefault config path distinguishes explicit resolution from discovery/default fallback.
 * @evidence contracts/testing.md#execution-ownership This named test_strip_uses_explicit_config_file_path entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Explicit configFile transfer through the descriptor and native driver must reach actual emitted output.
 * @evidence contracts/e2e.md#shared-execution The custom nested config pointer requires its own load; auto-discovery and duplicate-registration contexts do not establish this pointer connection. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage The nondefault config/my-strip.json must remove console.warn and retain console.log(keep-log). All original assertions remain in this named entry. TestLinkedProgramStripsDefaultStatementsAndPreservesDeclarations and TestLinkedProgramStripsCustomCallsOnlyInStatementPositions own AST list/body/callee/value-position distinctions; this case retains its original configuration or published-output boundary.
 */
export function test_strip_uses_explicit_config_file_path() {
  const root = TestProject.commonJsProject(
    {
      "src/main.ts": [
        `console.warn("drop-warn");`,
        `console.log("keep-log");`,
        `export const value = "ok";`,
        ``,
      ].join("\n"),
      "config/my-strip.json": JSON.stringify({
        calls: ["console.warn"],
        statements: [],
      }),
    },
    {
      compilerOptions: {
        plugins: [
          {
            transform: "@ttsc/strip",
            configFile: "config/my-strip.json",
          },
        ],
      },
    },
  );
  TestStrip.seedPackage(root);

  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    {
      cwd: root,
      env: {
        PATH: TestStrip.goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.doesNotMatch(js, /console\.warn/);
  assert.match(js, /console\.log\("keep-log"\)/);
}
