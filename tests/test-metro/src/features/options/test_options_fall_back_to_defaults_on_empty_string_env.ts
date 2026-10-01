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
 * @evidence contracts/testing.md#distinguishing-cases A present zero-length string distinguishes the length guard from absent-variable and malformed-JSON guards.
 * @evidence contracts/testing.md#execution-ownership This named src/features/options export calls authored options source in the serial source-unit runner; the helper restores the environment after each call and starts no installed artifact, native build or child process.
 */
export const test_options_fall_back_to_defaults_on_empty_string_env =
  async () => {
    await assertEmptyStringEnvFallsBackToDefaults();
  };
