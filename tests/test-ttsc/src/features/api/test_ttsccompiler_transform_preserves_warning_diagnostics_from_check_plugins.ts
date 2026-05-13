import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  tsgo,
  writeWarningCheckPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform preserves warning diagnostics from check
 * plugins.
 *
 * This ttsc API scenario is owned by a tests package instead of the production
 * package manifest, so package.json stays focused on build and publish
 * contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
 */
export const test_ttsccompiler_transform_preserves_warning_diagnostics_from_check_plugins =
  () => {
    const root = createProject({
      plugins: [{ transform: "./check-plugin.cjs" }],
    });
    writeWarningCheckPlugin(root);
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.equal(result.diagnostics?.length, 1);
    const diagnostic = expectArrayValue(result.diagnostics ?? [], 0);
    assert.equal(diagnostic.category, "warning");
    assert.equal(diagnostic.code, 9001);
    assert.match(expectRecordValue(result.typescript, "src/main.ts"), /api-ok/);
  };
