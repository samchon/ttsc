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
 *
 * @evidence contracts/testing.md#behavioral-verification resolveOptionsFromEnv returns undefined project, plugins and upstream plus empty include/exclude when its environment key is absent.
 * @evidence contracts/testing.md#independent-expectations Omitted options leave project and plugin discovery to the compiler; exact undefined fields and empty filters follow that contract.
 * @evidence contracts/testing.md#distinguishing-cases Absent payload contrasts populated options and explicit plugins:false in neighboring entries.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls resolveOptionsFromEnv from packages/metro/src/core/options.ts in-process after deleting TTSC_METRO_OPTIONS, restoring it afterwards; no child process, native build or installed package.
 */
export const test_options_default_to_tsconfig_discovery_when_env_is_absent =
  async () => {
    await assertOptionsDefaultWhenEnvAbsent();
  };
