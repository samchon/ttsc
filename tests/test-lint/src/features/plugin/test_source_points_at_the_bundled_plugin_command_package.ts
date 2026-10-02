import assert from "node:assert/strict";
import path from "node:path";

import { TestLintPlugin } from "../internal/TestLintPlugin";

/**
 * Verifies that the descriptor's `source` field points at the bundled Go plugin
 * directory.
 *
 * `descriptor.source` is the path the ttsc plugin builder uses to locate and
 * compile the Go sidecar. If it drifts from `packages/lint/plugin`, every
 * downstream build selects the wrong lint source.
 *
 * 1. Load the factory and call it with a minimal context.
 * 2. Assert `descriptor.source === TestLintPlugin.NATIVE_PLUGIN_DIR`.
 * 3. Relocate the descriptor to an emitted entry directory and require the
 *    source to follow that caller-provided location.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored factory computes source from the caller-provided descriptor directory and must return the native plugin directory, exercising path construction rather than reading repository source text.
 * @evidence contracts/testing.md#independent-expectations The descriptor factory contract locates plugin relative to its own source or emitted entry directory; the expected value is the helper's package-root/`plugin` path, derived from the package location rather than from the factory's dirname-relative computation.
 * @evidence contracts/testing.md#distinguishing-cases Source and relocated emitted-entry directories must each select their own sibling plugin directory. The relocated context distinguishes a hardcoded repository path from dirname-based resolution; neither assertion checks directory existence or native compilation.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls the authored descriptor factory with source-level context. It does not assert committed directory existence or compile that directory.
 */
export function test_source_points_at_the_bundled_plugin_command_package(): void {
  const factory = TestLintPlugin.loadFactory();
  const descriptor = factory(
    TestLintPlugin.factoryContext({ transform: "@ttsc/lint" }),
  );
  assert.equal(descriptor.source, TestLintPlugin.NATIVE_PLUGIN_DIR);
  const relocatedRoot = path.join(TestLintPlugin.PACKAGE_ROOT, "relocated-package");
  const relocated = factory({
    ...TestLintPlugin.factoryContext({ transform: "@ttsc/lint" }),
    dirname: path.join(relocatedRoot, "lib"),
    filename: path.join(relocatedRoot, "lib", "createTtscPlugin.js"),
  });
  assert.equal(relocated.source, path.join(relocatedRoot, "plugin"));
}
