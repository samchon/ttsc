import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies that the Next.js adapter chains into a user-provided `webpack`
 * callback rather than replacing it, and that the adapter's own plugin is still
 * appended to `config.plugins`.
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
