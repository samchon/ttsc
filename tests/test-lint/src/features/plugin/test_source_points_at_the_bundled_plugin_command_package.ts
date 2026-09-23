import assert from "node:assert/strict";

import { TestLintPlugin } from "../../internal/TestLintPlugin";

/**
 * Verifies that the descriptor's `source` field points at the bundled Go plugin
 * directory.
 *
 * `descriptor.source` is the path the ttsc plugin builder uses to locate and
 * compile the Go sidecar. If it drifts from `packages/lint/plugin`, every
 * downstream build silently gets no lint engine.
 *
 * 1. Load the factory and call it with a minimal context.
 * 2. Assert `descriptor.source === TestLintPlugin.NATIVE_PLUGIN_DIR`.
 */
export const test_source_points_at_the_bundled_plugin_command_package = () => {
  const factory = TestLintPlugin.loadFactory();
  const descriptor = factory(
    TestLintPlugin.factoryContext({ transform: "@ttsc/lint" }),
  );
  assert.equal(descriptor.source, TestLintPlugin.NATIVE_PLUGIN_DIR);
};
