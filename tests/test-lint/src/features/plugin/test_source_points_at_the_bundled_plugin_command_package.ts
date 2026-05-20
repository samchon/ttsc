import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../internal/TestLintPlugin";

/**
 * Verifies that the descriptor's `source` field points at the bundled Go plugin
 * directory and that the directory actually exists on disk.
 *
 * `descriptor.source` is the path the ttsc plugin builder uses to locate and
 * compile the Go sidecar. If it drifts from `packages/lint/plugin` or that
 * directory is deleted, every downstream build silently gets no lint engine.
 * This test also checks for `go.mod` and `plugin/main.go` so a mis-shaped
 * plugin source tree is caught before CI tries to compile it.
 *
 * 1. Load the factory and call it with a minimal context.
 * 2. Assert `descriptor.source === TestLintPlugin.NATIVE_PLUGIN_DIR`.
 * 3. Assert `packages/lint/go.mod` and `packages/lint/plugin/main.go` exist.
 */
export const test_source_points_at_the_bundled_plugin_command_package = () => {
  const factory = TestLintPlugin.loadFactory();
  const descriptor = factory(
    TestLintPlugin.factoryContext({ transform: "@ttsc/lint" }),
  );
  assert.equal(descriptor.source, TestLintPlugin.NATIVE_PLUGIN_DIR);
  // The Go module file must exist; otherwise the source build will fail.
  assert.ok(
    fs.existsSync(path.join(TestLintPlugin.PACKAGE_ROOT, "go.mod")),
    "go.mod is missing",
  );
  assert.ok(
    fs.existsSync(path.join(TestLintPlugin.NATIVE_PLUGIN_DIR, "main.go")),
    "plugin/main.go is missing",
  );
};
