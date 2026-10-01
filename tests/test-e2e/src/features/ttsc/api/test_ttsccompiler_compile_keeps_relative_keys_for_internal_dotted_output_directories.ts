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
 * Verifies TtscCompiler.compile keeps relative keys for internal dotted output
 * directories.
 *
 * When `outDir` starts with `..` (e.g. `..dist`) the Go binary can emit the
 * output paths as absolute strings because the anchor differs from the project
 * root. Pins the normalization pass that converts these back to relative keys
 * so API consumers always receive a uniform `Record<string, string>` map
 * regardless of how the tsconfig arranges its directories.
 *
 * 1. Create a project with `outDir: "..dist"` (dotted-prefix directory).
 * 2. Call `compile()` via the programmatic API.
 * 3. Assert output keys are relative strings and no key is an absolute path.
 *
 * @evidence contracts/testing.md#behavioral-verification Compiles with outDir ..dist, requires ..dist/main.js containing api-ok, rejects every absolute output key and checks no on-disk ..dist.
 * @evidence contracts/testing.md#independent-expectations The authored directory name ..dist is a child name, not parent traversal; the API contract represents internal outputs relative to the project root.
 * @evidence contracts/testing.md#distinguishing-cases This adjacent-to-dot-dot spelling distinguishes prefix misclassification from a true external output directory; source-directory spelling has a complementary transform case.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers the exported native compile feature; no plugin is loaded.
 * @evidence contracts/e2e.md#necessary-boundary Native output paths must normalize into JavaScript result keys without changing an internal dotted directory into an absolute path or publishing it.
 * @evidence contracts/e2e.md#shared-execution One no-plugin native compile supplies all path and output assertions using the shared tsgo executable and package build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh registered project owns the ..dist configuration and initial absence; synchronous compile finishes before inspection and suite exit removes the fixture.
 * @evidence contracts/e2e.md#preserved-coverage The literal key, output snippet, all-key relative check and absent directory remain executable. This entry does not exercise external outDir roots.
 */
export const test_ttsccompiler_compile_keeps_relative_keys_for_internal_dotted_output_directories =
  () => {
    const root = createProject({
      outDir: "..dist",
    });
    const compiler = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      plugins: false,
    });

    const result = compiler.compile();

    assert.equal(result.type, "success");
    assert.match(expectRecordValue(result.output, "..dist/main.js"), /api-ok/);
    assert.equal(
      Object.keys(result.output).some((key) => path.isAbsolute(key)),
      false,
    );
    assert.equal(fs.existsSync(path.join(root, "..dist")), false);
  };
