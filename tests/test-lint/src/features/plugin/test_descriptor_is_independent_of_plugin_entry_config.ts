import assert from "node:assert/strict";

import { TestLintPlugin } from "../../internal/TestLintPlugin";

/**
 * Verifies descriptor is independent of plugin entry config.
 *
 * This lint plugin descriptor scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
