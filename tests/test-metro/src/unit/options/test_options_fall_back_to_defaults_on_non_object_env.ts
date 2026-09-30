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
 *
 * @evidence contracts/testing.md#behavioral-verification resolveOptionsFromEnv returns empty filters and undefined project/upstream for array, null, number, string and boolean JSON values.
 * @evidence contracts/testing.md#independent-expectations The transport contract requires an object payload; literal default fields are independent of the parser result.
 * @evidence contracts/testing.md#distinguishing-cases Five valid JSON non-object kinds exercise object admission separately from malformed JSON and absent input.
 * @evidence contracts/testing.md#execution-ownership This named src/unit/options export calls authored options source in the serial source-unit runner; the helper restores the environment after each call and starts no installed artifact, native build or child process.
 */
export const test_options_fall_back_to_defaults_on_non_object_env =
  async () => {
    await assertNonObjectEnvFallsBackToDefaults();
  };
