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
  name: "syntax diagnostics stop emit before JavaScript is written",
  root: () =>
    commonJsProject(FixtureFiles.read("ttsc/compiler_corpus_syntax_diagnostics_stop_emit_before_javascript_is_written/inputs-1")),
  run(root: string) {
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Expression expected|Declaration or statement expected/,
    );
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  },
};

/**
 * Verifies compiler corpus: a syntax error stops emit before JavaScript is
 * written.
 *
 * Complements the semantic-diagnostic guard by covering parse-phase errors. A
 * source file with invalid syntax (e.g. a bare `=` with no right-hand side)
 * must halt compilation and leave the `outDir` clean. Without this gate the
 * compiler could parse enough of the file to emit partial JavaScript.
 *
 * 1. Create a CommonJS project with a syntax error in `src/main.ts`.
 * 2. Run `ttsc --emit`.
 * 3. Assert non-zero exit, a syntax-error message on stderr, and no
 *    `dist/main.js`.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs ttsc emit on export const broken equals with no expression; asserts nonzero exit, an expression/declaration syntax diagnostic and no dist/main.js.
 * @evidence contracts/testing.md#independent-expectations The authored absent expression is syntactically invalid under TypeScript and must gate ttsc emission. Literal diagnostic alternatives and output absence detect partial emit despite parse failure.
 * @evidence contracts/testing.md#distinguishing-cases Owns source parse-error gating, contrasted with valid config and no semantic prerequisite. Semantic and malformed-config failures execute in sibling entries.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_syntax_diagnostics_stop_emit_before_javascript_is_written is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary Native parser failure must propagate through the actual launcher and prevent filesystem output; parser-rule units alone cannot prove this emit gate.
 * @evidence contracts/e2e.md#shared-execution One compiler command captures status, parser diagnostic and suppressed output. Existing native compiler/launcher preparation is shared with the corpus and no Go plugin is built.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A unique fresh CommonJS project prevents prior successful artifacts affecting the absence result. Synchronous child exit precedes inspection and TestProject owns the root until process exit.
 * @evidence contracts/e2e.md#preserved-coverage All three existing status/diagnostic/output assertions remain in project.run. The accepted syntax diagnostic wording has two compiler-valid alternatives without claiming an exact diagnostic code.
 */
export const test_compiler_corpus_syntax_diagnostics_stop_emit_before_javascript_is_written =
  (): void => {
    const root = project.root();
    project.run(root);
  };
