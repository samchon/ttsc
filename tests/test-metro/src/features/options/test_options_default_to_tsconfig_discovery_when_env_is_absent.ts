import { assertOptionsDefaultWhenEnvAbsent } from "../../internal/metro-options";

/**
 * Verifies options default to tsconfig discovery when the env is absent.
 *
 * `withTtsc(config)` with no options is the common case: the transformer should
 * auto-discover `tsconfig.json` and run its configured plugins. That requires
 * the resolver to yield no project/plugin overrides and empty include/exclude
 * when the env var is unset.
 *
 * 1. Clear the env var.
 * 2. Resolve options.
 * 3. Assert no project/plugin/upstream override and empty include/exclude.
 */
export const test_options_default_to_tsconfig_discovery_when_env_is_absent =
  async () => {
    await assertOptionsDefaultWhenEnvAbsent();
  };
