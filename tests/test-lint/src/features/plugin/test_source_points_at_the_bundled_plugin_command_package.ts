import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../internal/TestLintPlugin";

/**
 * Verifies source points at the bundled plugin command package.
 *
 * This lint plugin descriptor scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
