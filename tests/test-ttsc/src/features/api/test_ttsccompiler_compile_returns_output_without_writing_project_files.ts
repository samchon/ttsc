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
 * The programmatic API is designed for in-process bundler pipelines that need
 * the emitted JS, declarations, and source maps without writing anything to
 * disk. Pins the complete output contract: `.js`, `.d.ts`, `.js.map`, and
 * `.d.ts.map` must all be present in the result map while `dist/` stays absent
 * on the filesystem.
 *
 * 1. Create a minimal project with no plugins.
 * 2. Call `compile()` via the programmatic API.
 * 3. Assert all four output file types are in the result map and `dist/` was not
 *    created.
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
