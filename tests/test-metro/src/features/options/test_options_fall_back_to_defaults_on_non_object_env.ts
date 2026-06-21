import { assertNonObjectEnvFallsBackToDefaults } from "../../internal/metro-options";

/**
 * Verifies options fall back to defaults on a non-object env payload.
 *
 * Valid JSON that is not a plain object (an array, `null`, a number, a string,
 * a boolean) must degrade to defaults via the non-object branch of `parse`
 * (distinct from the malformed-JSON catch). An array in particular must not
 * slip through the `typeof === "object"` guard and reach the worker.
 *
 * 1. For each non-object JSON payload, set the env var.
 * 2. Resolve options.
 * 3. Assert defaults: no overrides, empty include/exclude.
 */
export const test_options_fall_back_to_defaults_on_non_object_env =
  async () => {
    await assertNonObjectEnvFallsBackToDefaults();
  };
