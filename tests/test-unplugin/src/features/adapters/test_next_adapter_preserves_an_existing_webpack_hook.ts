import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies the Next.js wrapper chains into a caller's `webpack` hook instead of
 * replacing it.
 *
 * A Next.js config often carries its own `webpack` customization. Replacing it
 * would silently drop that setup, so the wrapper has to call it and then append
 * its plugin to the config the hook returns.
 *
 * 1. Wrap a config whose `webpack` hook marks the config it receives.
 * 2. Call the wrapped hook with an empty plugin list.
 * 3. Assert the caller's hook ran, its change survived, and exactly one plugin was
 *    appended.
 */
export async function test_next_adapter_preserves_an_existing_webpack_hook(): Promise<void> {
  const unpluginNext = await TestUnpluginRuntime.loadUnpluginAdapter("next");
  let called = false;
  const next = unpluginNext({
    webpack(config: Record<string, unknown> & { original?: boolean }) {
      called = true;
      config.original = true;
      return config;
    },
  });
  const config = next.webpack?.({ plugins: [] }, {}) as
    | { original?: boolean; plugins?: unknown[] }
    | undefined;
  assert.equal(called, true);
  assert.equal(config?.original, true);
  assert.equal(config?.plugins?.length, 1);
}
