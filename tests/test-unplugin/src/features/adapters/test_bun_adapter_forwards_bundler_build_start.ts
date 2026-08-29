import { assertBunAdapterRevalidatesOnBuildStart } from "../../internal/adapter-bun";

/**
 * Verifies Bun bundler builds open a new delivery pass.
 *
 * Bun's bundler exposes `onStart`, while its runtime plugin builder does not.
 * Ignoring the bundler hook lets first-use modules in a previous generation
 * cross a rebuild boundary without ever re-proving it.
 *
 * 1. Compile a project whose generation includes an unrequested second module.
 * 2. Corrupt another project input and invoke the captured build-start hook.
 * 3. Request the second module and assert a fresh compile observes the error.
 */
export const test_bun_adapter_forwards_bundler_build_start = async () => {
  await assertBunAdapterRevalidatesOnBuildStart();
};
