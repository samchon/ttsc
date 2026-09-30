import { loadNext } from "../internal/adapter-next/loadNext";
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
 * @evidence contracts/testing.md#behavioral-verification
 *   Calls authored next and the returned webpack hook, asserting the caller runs, its original property survives and one plugin is injected; replacing the caller or double injection fails independently.
 * @evidence contracts/testing.md#independent-expectations
 *   The additive wrapper contract requires calling the supplied hook and preserving its returned customization. The caller boolean, original property and literal plugin count are independent of wrapper internals.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Uses an existing hook and empty plugin list; wires_both_bundlers owns the no-caller positive case and preserves_turbopack_config owns rule-shape negatives. No real webpack compiler is needed for hook composition.
 * @evidence contracts/testing.md#execution-ownership
 *   This selectable exported unit calls authored next through loadNext or loadNextModule and fixture filesystem observations, without an installed consumer, native build or real bundler. The packed package batch owns export loading and actual host delivery; the session-inheritance E2E owns worker environment transport.
 */
export async function test_next_adapter_preserves_an_existing_webpack_hook(): Promise<void> {
  const unpluginNext = await loadNext();
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
