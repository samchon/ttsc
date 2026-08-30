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
 */
export const test_transformer_propagates_genuine_compile_errors = async () => {
  await assertGenuineCompileErrorPropagates();
};
