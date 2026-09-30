import assert from "node:assert/strict";

import { TestLintPlugin } from "../internal/TestLintPlugin";

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
 *
 * @evidence contracts/testing.md#behavioral-verification The authored factory computes source from the caller-provided descriptor directory and must return the native plugin directory, exercising path construction rather than reading repository source text.
 * @evidence contracts/testing.md#independent-expectations The descriptor factory contract locates plugin relative to its own source or emitted entry directory; the expected package-root/plugin path is a fixture context input.
 * @evidence contracts/testing.md#distinguishing-cases The minimal valid context pins the normal sibling-directory mapping; entry variation is owned by the independent-entry unit and real build discovery by native lint E2E.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls the authored descriptor factory with source-level context. It does not assert committed directory existence or compile that directory.
 */
export function test_source_points_at_the_bundled_plugin_command_package(): void {
  const factory = TestLintPlugin.loadFactory();
  const descriptor = factory(
    TestLintPlugin.factoryContext({ transform: "@ttsc/lint" }),
  );
  assert.equal(descriptor.source, TestLintPlugin.NATIVE_PLUGIN_DIR);
}
