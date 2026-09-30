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
