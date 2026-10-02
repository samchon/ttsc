import { loadNext } from "../internal/adapter-next/loadNext";
import assert from "node:assert/strict";

/**
 * Verifies the Next.js wrapper chains into a caller's `webpack` hook instead of
 * replacing it.
 *
 * A Next.js config often carries its own `webpack` customization. Replacing it
 * would silently drop that setup, so the wrapper has to inject its plugin into
 * the config and then call the caller's hook with that config, returning what
 * the hook returns.
 *
 * 1. Wrap a config whose `webpack` hook marks the config it receives.
 * 2. Call the wrapped hook with an empty plugin list.
 * 3. Assert the caller's hook ran, its mark is on the returned config, and the
 *    returned config holds exactly one plugin.
 * @evidence contracts/testing.md#behavioral-verification
 *   Calls the authored next wrapper and the webpack hook it returns on `{ plugins: [] }`. The assertions require the caller's hook to have run (a flag), its `original` mark to appear on the returned config, and the plugin list to have length one; a wrapper that dropped the caller's hook or injected no plugin or two fails. A second hook returns a different object and the wrapper must return exactly that object, so a wrapper that returned its own config fails.
 * @evidence contracts/testing.md#independent-expectations
 *   The expectations are literals authored in the test body (a called flag, `original === true`, plugin count 1 seen inside the hook, the hook's own returned object, an existing plugin kept second) taken from the documented additive-wrapper contract (the plugin is injected before the caller's hook runs and the hook's result is preserved), not computed from the wrapper's code; the plugin itself is not inspected, only counted.
 * @evidence contracts/testing.md#distinguishing-cases
 *   A caller-supplied hook over an empty plugin list, a hook that returns a different object, and an existing plugin that must stay behind the injected one. The no-caller case is not exercised here (check test_next_adapter_wires_both_bundlers), nor are turbopack rule shapes (test_next_adapter_preserves_turbopack_config).
 * @evidence contracts/testing.md#execution-ownership
 *   Unit test: test_next_adapter_preserves_an_existing_webpack_hook calls the loadNext wrapper around the real next() and then its returned webpack hook in process; no webpack compiler, Next build or worker starts.
 */
export async function test_next_adapter_preserves_an_existing_webpack_hook(): Promise<void> {
  const unpluginNext = await loadNext();
  let called = false;
  let pluginsSeenByHook = -1;
  const next = unpluginNext({
    webpack(config: Record<string, unknown> & { original?: boolean }) {
      called = true;
      config.original = true;
      pluginsSeenByHook = (config.plugins as unknown[]).length;
      return config;
    },
  });
  const config = next.webpack?.({ plugins: [] }, {}) as
    | { original?: boolean; plugins?: unknown[] }
    | undefined;
  assert.equal(called, true);
  assert.equal(config?.original, true);
  assert.equal(config?.plugins?.length, 1);
  assert.equal(
    pluginsSeenByHook,
    1,
    "the caller's hook runs after the plugin is injected",
  );

  const existing = { apply() {} };
  const replacement = { replaced: true, plugins: ["from-hook"] };
  const chained = unpluginNext({ webpack: () => replacement });
  assert.equal(
    chained.webpack?.({ plugins: [existing] }, {}),
    replacement,
    "the wrapper returns what the caller's hook returns, not its own config",
  );

  const prepended = unpluginNext({ webpack: (config) => config });
  const ordered = prepended.webpack?.({ plugins: [existing] }, {}) as {
    plugins: unknown[];
  };
  assert.equal(ordered.plugins.length, 2);
  assert.equal(
    ordered.plugins[1],
    existing,
    "an existing plugin stays after the injected one",
  );
  assert.notEqual(ordered.plugins[0], existing);
}
