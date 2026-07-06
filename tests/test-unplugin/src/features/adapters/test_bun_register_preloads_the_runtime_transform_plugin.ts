import { assertBunRegisterRegistersRuntimePlugin } from "../../internal/adapter-bun-register";

/**
 * Verifies bun-register preloads the runtime transform plugin.
 *
 * `@ttsc/unplugin/bun-register` is the Bun _runtime_ counterpart to the bundler
 * adapters (typia #1534): a `bunfig.toml` `preload` imports it so `bun run` /
 * `bun test` apply ttsc transforms on import. A regression could make importing
 * it throw under Node (breaking tooling) or make `register()` silently no-op
 * off Bun (hiding misconfiguration). This pins the guard and the registration.
 *
 * 1. Import the built `bun-register` entry (a no-op under Node).
 * 2. Assert an explicit `register()` off Bun throws a clear "Bun runtime" error.
 * 3. Stub `globalThis.Bun.plugin` and assert `register()` forwards the
 *    `ttsc-unplugin` adapter to it.
 */
export const test_bun_register_preloads_the_runtime_transform_plugin =
  async () => {
    await assertBunRegisterRegistersRuntimePlugin();
  };
