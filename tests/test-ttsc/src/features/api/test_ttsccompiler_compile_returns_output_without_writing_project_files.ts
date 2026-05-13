import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  fs,
  path,
  tsgo,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.compile returns output without writing project files.
 *
 * This ttsc API scenario is owned by a tests package instead of the production
 * package manifest, so package.json stays focused on build and publish
 * contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
 */
export const test_ttsccompiler_compile_returns_output_without_writing_project_files =
  () => {
    const root = createProject();
    const compiler = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      plugins: false,
    });

    const result = compiler.compile();

    assert.equal(result.type, "success");
    assert.match(expectRecordValue(result.output, "dist/main.js"), /api-ok/);
    assert.match(
      expectRecordValue(result.output, "dist/main.js"),
      /console\.log\(\s*message\s*\)/,
    );
    assert.match(
      expectRecordValue(result.output, "dist/main.d.ts"),
      /declare const message/,
    );
    assert.match(
      expectRecordValue(result.output, "dist/main.js.map"),
      /"version":3/,
    );
    assert.match(
      expectRecordValue(result.output, "dist/main.d.ts.map"),
      /"version":3/,
    );
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
  };
