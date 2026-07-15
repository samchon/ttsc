import { assertBunRegisterPreloadOnlyRegistersOneDefaultPlugin } from "../../internal/adapter-bun-register";

/**
 * Verifies a preload-only bun-register import registers one default plugin
 * (#676).
 *
 * The negative twin of the same-runtime shadowing fix: the one-line
 * `bunfig.toml` preload convenience must keep working. Importing the side-effect
 * entry under Bun with no explicit `register` call must register exactly one
 * default loader, which transforms using the project's own tsconfig
 * configuration.
 *
 * 1. Freshly evaluate the entry with a Bun-like global present and make no
 *    explicit `register` call.
 * 2. Assert exactly one plugin was registered.
 * 3. Drive that plugin and assert it applies the fixture's tsconfig-declared
 *    transform.
 */
export const test_bun_register_preload_only_registers_a_single_default_plugin =
  async () => {
    await assertBunRegisterPreloadOnlyRegistersOneDefaultPlugin();
  };
