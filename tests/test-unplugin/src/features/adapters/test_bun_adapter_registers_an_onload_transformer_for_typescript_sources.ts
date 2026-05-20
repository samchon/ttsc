import { assertBunAdapterTransformsSource } from "../../internal/adapter-bun";

/**
 * Verifies bun adapter registers an onLoad transformer for TypeScript sources.
 *
 * Bun has no native unplugin bridge; the adapter must register itself via
 * `setup({ onLoad })` with a `.ts/.tsx` filter. A misconfigured filter or a
 * missing `onLoad` call would silently skip the transform and leave source code
 * untouched. This pins that the adapter registers exactly one loader whose
 * filter matches `.ts` files and that the loader returns transformed output.
 *
 * 1. Load the bun adapter and create a fixture project.
 * 2. Call `unpluginBun().setup(...)` with a stub that captures `onLoad`
 *    registrations.
 * 3. Assert the registered filter matches the project's main `.ts` file.
 * 4. Invoke the loader with the main file path and assert the output is
 *    plugin-transformed.
 */
export const test_bun_adapter_registers_an_onload_transformer_for_typescript_sources =
  async () => {
    await assertBunAdapterTransformsSource();
  };
