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
 */
export const test_options_fall_back_to_defaults_on_malformed_env = async () => {
  await assertOptionsFallBackOnMalformedEnv();
};
