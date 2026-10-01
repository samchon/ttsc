import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/compiler-corpus";

const project = {
  name: "semantic diagnostics stop emit before JavaScript is written",
  root: () =>
    commonJsProject(FixtureFiles.read("ttsc/compiler_corpus_semantic_diagnostics_stop_emit_before_javascript_is_written/inputs-1")),
  run(root: string) {
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Type 'number' is not assignable to type 'string'/,
    );
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  },
};

/**
 * Verifies compiler corpus: a semantic type error stops emit before JavaScript
 * is written.
 *
 * Pins the semantic-gating behavior: when a type error exists (e.g. `number`
 * assigned to `string`), the CLI must report the error and exit non-zero
 * without producing any output file. Without this guard the Go backend could
 * emit partial output and leave a corrupt `dist/` tree for the next build.
 *
 * 1. Create a CommonJS project with a type error in `src/main.ts`.
 * 2. Run `ttsc --emit`.
 * 3. Assert non-zero exit, the type-error message on stderr, and no
 *    `dist/main.js`.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs ttsc emit on a number assigned to string; asserts nonzero exit, number-not-assignable-to-string diagnostic and no dist/main.js.
 * @evidence contracts/testing.md#independent-expectations TypeScript assignability independently rejects this authored mismatch, and ttsc gates emit on diagnostics. Literal diagnostic text and absence detect a backend that emits despite reporting the error.
 * @evidence contracts/testing.md#distinguishing-cases Owns semantic error gating after syntactically valid parsing. Syntax and malformed-config failures have separate entries; valid emit has other positive owners.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_semantic_diagnostics_stop_emit_before_javascript_is_written is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary The real compiler diagnostic must travel through the launcher and stop the output writer. An assignability unit alone cannot prove transport or emission gating.
 * @evidence contracts/e2e.md#shared-execution One compiler invocation owns the error, process status and output check. Built compiler installation is shared; the fixture needs no Go plugin build or runtime execution.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A unique fresh root contains only the authored bad source, so previous successful output cannot contaminate the absence check. The child is synchronous and TestProject removes its tree at exit.
 * @evidence contracts/e2e.md#preserved-coverage All status/diagnostic/no-output assertions remain in project.run; no compiler diagnostic text is synthesized by the test and no broader semantic matrix is claimed.
 */
export const test_compiler_corpus_semantic_diagnostics_stop_emit_before_javascript_is_written =
  (): void => {
    const root = project.root();
    project.run(root);
  };
