import { assertGenuineCompileErrorPropagates } from "../../internal/metro-transform";

/**
 * Verifies the transformer propagates genuine compile/plugin errors.
 *
 * The negative twin of the out-of-project pass-through: a real failure must NOT
 * be swallowed as "outside project". This pins the `isFileOutsideProject` FALSE
 * branch (rethrow). Exercises the real native compiler (Go source plugin) →
 * runs in CI.
 *
 * 1. Create a fixture whose source the plugin rejects.
 * 2. Transform it.
 * 3. Assert it rejects with an error that is NOT the "did not return output" case.
 */
export const test_transformer_propagates_genuine_compile_errors = async () => {
  await assertGenuineCompileErrorPropagates();
};
