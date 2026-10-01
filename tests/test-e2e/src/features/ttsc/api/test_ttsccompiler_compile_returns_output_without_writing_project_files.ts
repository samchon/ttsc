import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  fs,
  path,
  tsgo,
} from "../../../internal/ttsc/internal/compiler";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Calls compile against the real native compiler and checks returned JavaScript, declaration and both map contents, plus absence of a written dist directory.
 * @evidence contracts/testing.md#independent-expectations The authored message and console call establish the JavaScript literals; the requested declarations and version-3 map contract establish the other expected output forms without deriving them from compile.
 * @evidence contracts/testing.md#distinguishing-cases This valid no-plugin project distinguishes in-memory compile output from disk emit and checks all four requested output families. Diagnostic failures and plugin transformations have separate API entries.
 * @evidence contracts/testing.md#execution-ownership The matching exported feature function is discovered by TestExecutor and runs TtscCompiler.compile through a native process, so it belongs to the boundary population.
 * @evidence contracts/e2e.md#necessary-boundary The JavaScript API must transport actual native compile output into result.output without publishing project files; a decoder unit cannot prove the producer sends those outputs or honors the in-memory mode.
 * @evidence contracts/e2e.md#shared-execution The suite reuses its built ttsc package and resolved tsgo executable. This case starts one compile process, disables plugins and performs every output-family assertion on that single result.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject allocates a fresh TestProject-owned directory and source/config, avoiding output left by an earlier emit. The synchronous compile owns its process; the suite exit hook removes registered fixture directories.
 * @evidence contracts/e2e.md#preserved-coverage The original success, message, console call, declaration, two map versions and no-dist assertions all remain on one compile result. These checks constrain output snippets rather than the complete generated program.
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
