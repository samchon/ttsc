import assert from "node:assert/strict";

import { TestLintPlugin } from "../../internal/TestLintPlugin";

/**
 * Verifies that the `@ttsc/lint` JS factory returns a descriptor whose `stage`
 * and `source` are structural constants, independent of the tsconfig plugin
 * entry it receives.
 *
 * The factory validates the entry's keys (only the framework keys plus
 * `configFile` are accepted) and reads `configFile` for contributor discovery,
 * but `stage` and `source` never vary with the entry — they are fixed. This
 * pins the contract so a future change cannot accidentally make host-binary
 * selection data-driven.
 *
 * 1. Load the factory from the built `lib/index.js`.
 * 2. Call it twice with distinct valid plugin entries (one bare, one naming a
 *    `configFile`).
 * 3. Assert both descriptors have the same `stage` and `source` values.
 */
export const test_descriptor_is_independent_of_plugin_entry_config = () => {
  const factory = TestLintPlugin.loadFactory();
  const a = factory(TestLintPlugin.factoryContext({ transform: "x" }));
  const b = factory(
    TestLintPlugin.factoryContext({
      transform: "y",
      configFile: "./does-not-exist.config.json",
    }),
  );
  assert.equal(a.stage, b.stage);
  assert.equal(a.source, b.source);
};
