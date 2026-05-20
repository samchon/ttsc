import { assertNextAdapterPreservesWebpackHook } from "../../internal/adapter-entrypoints";

/**
 * Verifies next adapter preserves an existing webpack hook.
 *
 * Next.js config objects frequently carry a user-defined `webpack` callback.
 * The adapter must chain into that callback rather than replace it, otherwise
 * the user's existing webpack customization is silently discarded. This pins
 * that the adapter calls the user's hook and that the adapter's own plugin is
 * still appended to `config.plugins`.
 *
 * 1. Load the next adapter and construct a plugin instance that supplies a
 *    user-provided `webpack` callback.
 * 2. Invoke the adapter's `webpack` hook with a minimal webpack config.
 * 3. Assert the user callback was called and its mutation is visible.
 * 4. Assert the adapter appended its own plugin so `config.plugins.length` equals
 *    1.
 */
export const test_next_adapter_preserves_an_existing_webpack_hook =
  async () => {
    await assertNextAdapterPreservesWebpackHook();
  };
