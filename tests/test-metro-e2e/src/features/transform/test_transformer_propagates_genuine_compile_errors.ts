import { assertGenuineCompileErrorPropagates } from "../../internal/metro-transform";

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
 * @evidence contracts/testing.md#execution-ownership This named features export test_transformer_propagates_genuine_compile_errors executes the compiled Metro package in the E2E runner; source units own its portable decisions and the leaf helper retains this case assertions.
 * @evidence contracts/e2e.md#necessary-boundary The actual plugin compiler failure must cross the native host and adapter without being swallowed as project exclusion.
 * @evidence contracts/e2e.md#shared-execution One malformed project uses the suite shared plugin producer; only its native transform runs and no successful replacement generation masks the failure.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The broken source belongs to this tracked project and configured upstream options restore after rejection. The compiler request ends before runner-owned project/cache cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The original rejection predicate naming goUpper remains unchanged.
 */
export const test_transformer_propagates_genuine_compile_errors = async () => {
  await assertGenuineCompileErrorPropagates();
};
