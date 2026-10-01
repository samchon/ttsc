import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestStrip } from "../../../internal/TestStrip";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

/**
 * Verifies the @ttsc/strip plugin: package ttsc.plugin auto-discovers strip
 * defaults.
 *
 * When `@ttsc/strip` appears in `package.json` dependencies without a matching
 * tsconfig plugin entry, the plugin is auto-registered with its built-in
 * default config (`console.log`, `console.debug`, `assert.*`, and `debugger`).
 * This pins the default stripping contract so changes to the default list break
 * here rather than silently passing through to the user's build.
 *
 * 1. Create a CommonJS project whose source uses all four default strip targets
 *    plus a `kept` export, with `package.json` listing `@ttsc/strip`.
 * 2. Run `ttsc --emit` without any tsconfig plugin configuration.
 * 3. Assert the emitted `.js` contains `kept` and none of the stripped calls or
 *    `debugger`.
 *
 * @evidence contracts/testing.md#behavioral-verification Dependency-only registration must remove console.log, console.debug, assert.equal and debugger while retaining kept in emitted JS.
 * @evidence contracts/testing.md#independent-expectations The public default strip targets and authored kept export independently define removed and retained output.
 * @evidence contracts/testing.md#distinguishing-cases All four defaults are positive and the export is negative; custom policy cases own the adjacent opt-out behavior.
 * @evidence contracts/testing.md#execution-ownership This named test_strip_package_auto_uses_default_config entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Package auto registration must invoke the native default transform and publish rewritten output.
 * @evidence contracts/e2e.md#shared-execution One unconfigured project checks every default target together; explicit custom configuration and nested discovery need different host contexts. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage Dependency-only registration must remove console.log, console.debug, assert.equal and debugger while retaining kept in emitted JS. All original assertions remain in this named entry. TestLinkedProgramStripsDefaultStatementsAndPreservesDeclarations and TestLinkedProgramStripsCustomCallsOnlyInStatementPositions own AST list/body/callee/value-position distinctions; this case retains its original configuration or published-output boundary.
 */
export function test_strip_package_auto_uses_default_config() {
  const root = TestProject.commonJsProject({
    "src/main.ts": [
      `declare const assert: { equal(left: unknown, right: unknown): void };`,
      `console.log("drop-log");`,
      `console.debug("drop-debug");`,
      `assert.equal("drop", "assert");`,
      `debugger;`,
      `export const value = "kept";`,
      ``,
    ].join("\n"),
  });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ dependencies: { "@ttsc/strip": "*" } }),
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
  assert.match(js, /kept/);
  assert.doesNotMatch(js, /console\.(?:log|debug)|assert\.equal|\bdebugger\b/);
}
