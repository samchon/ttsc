import assert from "node:assert/strict";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { fakeUpstreamOptions } from "../../../internal/metro/internal/metro-snapshot";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";

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
 * @evidence contracts/testing.md#independent-expectations The authored input omits the call required by the plugin; its named diagnostic independently rejects vacuous infrastructure errors.
 * @evidence contracts/testing.md#distinguishing-cases True plugin failure contrasts out-of-program pass-through, so broad error swallowing cannot satisfy both boundaries.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_metro, which is discovered under src/features and selected by the E2E Evidence claim; this exported scenario executes the compiled Metro package, while source units own its portable decisions.
 * @evidence contracts/e2e.md#necessary-boundary The actual plugin compiler failure must cross the native host and adapter without being swallowed as project exclusion.
 * @evidence contracts/e2e.md#shared-execution One malformed project uses the suite shared plugin producer; only its native transform runs and no successful replacement generation masks the failure. Its project is a slot of the experiment's single workspace, written or copied by MetroWorkspace instead of being created as a separate temporary directory.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity  Entering the slot replaces it, which removes any earlier snapshot, epoch and recorded input, and the experiment removes the whole workspace and verifies its absence once, after the last scenario.
 * @evidence contracts/e2e.md#preserved-coverage The original rejection predicate naming goUpper remains unchanged.
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
    // Load-bearing: must reject with the actual plugin error (mentions
    // goUpper) rather than a vacuous environment failure. A module the program
    // does not contain no longer reaches this path at all: the shared core
    // returns `undefined` for it, so there is no swallow string left to
    // distinguish from a real failure (samchon/ttsc#1308).
    (error: Error) => /goUpper/.test(error.message),
  );
}
