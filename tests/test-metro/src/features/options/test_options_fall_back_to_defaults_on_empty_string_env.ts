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
 */
export const test_options_fall_back_to_defaults_on_empty_string_env =
  async () => {
    await assertEmptyStringEnvFallsBackToDefaults();
  };
