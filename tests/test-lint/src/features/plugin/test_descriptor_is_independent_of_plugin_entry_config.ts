import assert from "node:assert/strict";

import { TestLintPlugin } from "../../internal/TestLintPlugin";

/**
 * Verifies that the `@ttsc/lint` JS factory returns the same descriptor
 * regardless of the `plugin` context object it receives.
 *
 * The factory currently ignores `context.plugin` entirely — rules are forwarded
 * to the native engine via `--plugins-json`, not via the descriptor. Calling
 * the factory with different (arbitrary) plugin objects must therefore produce
 * identical `stage` and `source` values, pinning the contract that the
 * descriptor is purely structural and not data-driven.
 *
 * 1. Load the factory from the built `lib/index.js`.
 * 2. Call it twice with distinct `plugin` objects (one with `config`, one empty).
 * 3. Assert both descriptors have the same `stage` and `source` values.
 */
export const test_descriptor_is_independent_of_plugin_entry_config = () => {
  // The factory ignores context.plugin today (rules are read on the
  // native side via --plugins-json). Calling with arbitrary input should
  // still produce a stable descriptor.
  const factory = TestLintPlugin.loadFactory();
  const a = factory(
    TestLintPlugin.factoryContext({
      transform: "x",
      config: { "no-var": "error" },
    }),
  );
  const b = factory(
    TestLintPlugin.factoryContext({ transform: "y", config: {} }),
  );
  assert.equal(a.stage, b.stage);
  assert.equal(a.source, b.source);
};
