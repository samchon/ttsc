import {
  assert,
  factoryContext,
  fs,
  goPluginDir,
  goSourceDir,
  loadFactory,
  path,
} from "../../internal/plugin";

/**
 * Verifies source points at the bundled plugin command package.
 *
 * This lint plugin descriptor scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_source_points_at_the_bundled_plugin_command_package = () => {
  const factory = loadFactory();
  const descriptor = factory(factoryContext({ transform: "@ttsc/lint" }));
  assert.equal(descriptor.source, goPluginDir);
  // The Go module file must exist; otherwise the source build will fail.
  assert.ok(
    fs.existsSync(path.join(goSourceDir, "go.mod")),
    "go.mod is missing",
  );
  assert.ok(
    fs.existsSync(path.join(goPluginDir, "main.go")),
    "plugin/main.go is missing",
  );
};
