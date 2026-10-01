import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TestStrip } from "../internal/TestStrip";
import { SHARED_PLUGIN_CACHE_DIR } from "../internal/plugin-cache";

/**
 * Verifies the @ttsc/strip plugin: rejects inline configuration keys in the
 * tsconfig plugin entry.
 *
 * Locks the validation path in the JS descriptor factory and the Go driver:
 * keys like `calls` and `statements` that were formerly accepted inline on the
 * tsconfig plugin entry must now be rejected with a clear error. This prevents
 * stale tsconfig entries from silently falling back to defaults instead of
 * surfacing a migration hint.
 *
 * 1. Create a project whose tsconfig plugin entry contains `calls` directly (the
 *    old inline shape).
 * 2. Run `ttsc --emit`.
 * 3. Assert a non-zero exit and that stderr mentions the unsupported key and
 *    points the user to a strip.config.* file.
 *
 * @evidence contracts/testing.md#behavioral-verification The launcher must reject the obsolete inline calls entry with a nonzero exit and an error naming calls.
 * @evidence contracts/testing.md#independent-expectations The dedicated-config contract independently disallows inline calls in plugin entries.
 * @evidence contracts/testing.md#distinguishing-cases Invalid calls is the negative entry case; direct factory units own key variations and configured emit cases own valid inputs.
 * @evidence contracts/testing.md#execution-ownership This named test_strip_rejects_inline_config_keys entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Descriptor validation must propagate an invalid tsconfig plugin entry to the public launcher failure.
 * @evidence contracts/e2e.md#shared-execution One rejected load remains to prove launcher propagation; it aborts before a native producer is built. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage The launcher must reject the obsolete inline calls entry with a nonzero exit and an error naming calls. All original assertions remain in this named entry. TestLinkedProgramStripsDefaultStatementsAndPreservesDeclarations and TestLinkedProgramStripsCustomCallsOnlyInStatementPositions own AST list/body/callee/value-position distinctions; this case retains its original configuration or published-output boundary.
 */
export function test_strip_rejects_inline_config_keys() {
  const root = TestProject.commonJsProject(
    {
      "src/main.ts": `console.log("hello");\nexport const v = 1;\n`,
    },
    {
      compilerOptions: {
        plugins: [
          {
            transform: "@ttsc/strip",
            // Old inline-config key — must be rejected now.
            calls: ["console.log"],
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
  assert.notEqual(
    result.status,
    0,
    "expected non-zero exit for inline config keys",
  );
  assert.match(
    result.stderr,
    /unsupported key.*"calls"|"calls".*unsupported key/,
    `stderr should name the unsupported key: ${result.stderr}`,
  );
}
