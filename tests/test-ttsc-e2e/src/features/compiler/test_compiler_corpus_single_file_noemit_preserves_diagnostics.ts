import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

/**
 * Verifies compiler corpus: single-file no-emit preserves diagnostics.
 *
 * Suppressing the final user-tree write must not skip the temporary compiler
 * pass that detects type errors. This pins the failed-build path rather than
 * only a clean analysis-only invocation.
 *
 * 1. Materialize a project with one type-invalid source file.
 * 2. Run that file through single-file `--noEmit`.
 * 3. Assert a TypeScript diagnostic and non-zero exit with no JavaScript output.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs positional broken.ts with noEmit on a string assigned to number; asserts nonzero exit, TS2322 in captured output and no dist/broken.js.
 * @evidence contracts/testing.md#independent-expectations TypeScript assignability rejects the authored mismatch even when emission is suppressed. Independent error code and output absence distinguish analysis-only checking from bypassing the compiler.
 * @evidence contracts/testing.md#distinguishing-cases Owns invalid positional noEmit input; valid noEmit forms and project-mode semantic errors execute in other entries.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_single_file_noemit_preserves_diagnostics is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary The compatibility path must still run real native checking and return its diagnostic while suppressing final writes. Option units cannot prove the compiler is actually invoked.
 * @evidence contracts/e2e.md#shared-execution One failing compiler command jointly owns status, diagnostic transport and suppression. Existing built native compiler/launcher are reused, with no plugin binary preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The root contains one fresh broken source and no old output, and synchronous completion precedes inspection. TestProject removes the entire fixture at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Nonzero status, TS2322 and broken.js absence remain unchanged in this exported body. This case does not assert exact diagnostic position or every possible emitted file.
 */
export const test_compiler_corpus_single_file_noemit_preserves_diagnostics =
  (): void => {
    const root = commonJsProject({
      "src/broken.ts": `const value: number = "not a number";\n`,
    });
    const result = spawn(
      ttscBin,
      ["--cwd", root, "--noEmit", "src/broken.ts"],
      { cwd: root },
    );
    assert.notEqual(result.status, 0, "invalid TypeScript must fail");
    assert.match(`${result.stdout}${result.stderr}`, /TS2322/);
    assert.equal(fs.existsSync(path.join(root, "dist", "broken.js")), false);
  };
