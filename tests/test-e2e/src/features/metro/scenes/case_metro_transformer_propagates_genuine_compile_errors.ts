import assert from "node:assert/strict";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";
import { fakeUpstreamOptions } from "../../../internal/metro/internal/metro-snapshot";

/**
 * Verifies the transformer propagates genuine compile/plugin errors.
 *
 * The negative twin of the out-of-project pass-through: a real failure must
 * still reach Metro. The two are now told apart by the shared core rather than
 * by this transformer matching on error text, so what this pins is that
 * removing that private special case did not start swallowing real failures
 * with it (samchon/ttsc#1308). Exercises the real native compiler (Go source
 * plugin) → runs in CI.
 *
 * 1. Create a fixture whose source the plugin rejects.
 * 2. Transform it.
 * 3. Assert it rejects with the plugin's own error.
 *
 * @evidence contracts/testing.md#behavioral-verification A real native plugin applied to an in-program source without goUpper rejects with the actual goUpper diagnostic.
 * @evidence contracts/testing.md#independent-expectations The authored input omits the plugin-required call and the original goUpper message predicate rejects unrelated errors without that word. The predicate does not independently certify a unique producer, exact diagnostic/status/stack or exclude another error containing goUpper.
 * @evidence contracts/testing.md#distinguishing-cases True plugin failure contrasts out-of-program pass-through, so broad error swallowing cannot satisfy both boundaries.
 * @evidence contracts/testing.md#execution-ownership test_e2e_metro invokes this selected rejection scenario through the default built transformer unless TTSC_TEST_LAYER=unit. The authored echo upstream is not a real Metro host/OS worker and source override is not built-boundary proof; direct failure helpers do not replace native producer delivery.
 * @evidence contracts/e2e.md#necessary-boundary The actual plugin compiler failure must cross the native host and adapter without being swallowed as project exclusion.
 * @evidence contracts/e2e.md#shared-execution One malformed owned fixture invokes one adapter transform through the selected shared producer and no success replacement is supplied. This parent rejection does not count native child/Program/cache outcomes; no per-error producer is deliberately prepared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Slot replacement drops prior recorded inputs; assert.rejects awaits settlement and runtime option env restoration, then parent collection/aggregate cleanup owns remaining resources. Settlement alone does not certify arbitrary descendant joins or loaded-image equality.
 * @evidence contracts/e2e.md#preserved-coverage Original broken number source without goUpper and the unchanged regex rejection remain. Its marker-only limitation is explicit without replacing native producer delivery by a portable throw; registration/built-layer binding/runtime survival/measurement remain unverified.
 */
export async function case_metro_transformer_propagates_genuine_compile_errors(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
  const broken = "export const broken: number = 1;\n";
  const root = MetroWorkspace.enterProject(workspace, { source: broken });
  await assert.rejects(
    TestMetroRuntime.runTransform({
      options: fakeUpstreamOptions(),
      params: {
        src: broken,
        filename: "src/main.ts",
        options: { projectRoot: root },
      },
    }),
    // Load-bearing: the rejection must mention goUpper rather than match an
    // unrelated environment failure without that word; this marker alone is
    // not unique producer/status/stack attribution. A module the program
    // does not contain no longer reaches this path at all: the shared core
    // returns `undefined` for it, so there is no swallow string left to
    // distinguish from a real failure (samchon/ttsc#1308).
    (error: Error) => /goUpper/.test(error.message),
  );
}
