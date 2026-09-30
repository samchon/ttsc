import assert from "node:assert/strict";

import { TestLintPlugin } from "../internal/TestLintPlugin";

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
 * 1. Call the authored descriptor factory.
 * 2. Call it twice with distinct valid plugin entries (one bare, one naming a
 *    `configFile`).
 * 3. Assert both descriptors have the same `stage` and `source` values.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored createTtscPlugin receives two distinct supported entries and its returned stage and source are compared, detecting accidental entry-controlled host selection.
 * @evidence contracts/testing.md#independent-expectations The descriptor contract fixes the check stage and bundled native source regardless of transform spelling or a missing explicitly named config.
 * @evidence contracts/testing.md#distinguishing-cases A bare entry and a differently spelled transform with nonexistent configFile must preserve identical stage and source; the factory capability unit owns the literal capability values.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls the authored factory directly, with no built package, consumer installation or Go build. The built-factory E2E retains package assembly verification.
 */
export function test_descriptor_is_independent_of_plugin_entry_config(): void {
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
}
