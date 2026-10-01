import { assertOptionsFallBackOnMalformedEnv } from "../../internal/metro-options";

/**
 * Verifies options fall back to defaults on a malformed env payload.
 *
 * The env var is process state that a stray export or a partial write could
 * corrupt. A parse failure must degrade to the auto-discovery defaults rather
 * than throw, otherwise one bad value would crash every Metro worker on the
 * first file.
 *
 * 1. Set the env var to invalid JSON.
 * 2. Resolve options.
 * 3. Assert defaults: no overrides and empty include/exclude.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveOptionsFromEnv accepts malformed JSON without throwing and returns undefined project/upstream and empty filters.
 * @evidence contracts/testing.md#independent-expectations Invalid transport JSON has documented discovery defaults; literal undefined and empty arrays independently establish those defaults.
 * @evidence contracts/testing.md#distinguishing-cases Malformed syntax exercises JSON parse failure, complementary to valid non-object, empty and absent payload entries.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls resolveOptionsFromEnv from packages/metro/src/core/options.ts in-process with TTSC_METRO_OPTIONS set to invalid JSON and restored afterwards; no child process, native build or installed package.
 */
export const test_options_fall_back_to_defaults_on_malformed_env = async () => {
  await assertOptionsFallBackOnMalformedEnv();
};
