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
 * Check-only plugins emit diagnostics without modifying the source tree. When a
 * plugin produces a warning (not an error), `transform()` should still return a
 * `success` result — the transform succeeded, but the warnings must be surfaced
 * in the `diagnostics` array so callers can relay them to the user.
 *
 * 1. Create a project with a check plugin that emits one warning diagnostic.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the result is `success`, `diagnostics` has one `warning`-category
 *    entry, and the typescript source is still returned.
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
