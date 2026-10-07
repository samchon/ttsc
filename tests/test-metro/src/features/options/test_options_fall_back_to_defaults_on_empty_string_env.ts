import { assertEmptyStringEnvFallsBackToDefaults } from "../../internal/metro-options";

/**
 * Verifies options fall back to defaults on an empty-string env payload.
 *
 * An empty string is distinct from an unset variable; it exercises the
 * `raw.length === 0` half of the guard in `parse`. It must degrade to the
 * auto-discovery defaults, not throw or produce a wrong shape.
 *
 * 1. Set the env var to "".
 * 2. Resolve options.
 * 3. Assert defaults: no project override, empty include/exclude.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveOptionsFromEnv treats the present empty environment string as defaults with undefined project and empty filters.
 * @evidence contracts/testing.md#independent-expectations An empty payload has the documented omitted-options behavior; exact undefined and empty-array assertions form the oracle.
 * @evidence contracts/testing.md#distinguishing-cases A present zero-length string is the boundary between the absent variable and malformed JSON. The observable result cannot show which internal guard produced the defaults, since JSON.parse of an empty string would also fall back; the entry only pins the resulting defaults.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls resolveOptionsFromEnv from packages/metro/src/core/options.ts in-process with TTSC_METRO_OPTIONS set to an empty string and restored afterwards; no child process, native build or installed package.
 */
export const test_options_fall_back_to_defaults_on_empty_string_env =
  async () => {
    await assertEmptyStringEnvFallsBackToDefaults();
  };
