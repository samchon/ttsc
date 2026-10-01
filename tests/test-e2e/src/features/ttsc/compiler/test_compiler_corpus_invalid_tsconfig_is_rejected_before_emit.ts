import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/compiler-corpus";

const project = {
  name: "invalid tsconfig is rejected before emit",
  root: () =>
    createProject(FixtureFiles.read("ttsc/compiler_corpus_invalid_tsconfig_is_rejected_before_emit/inputs-1")),
  run(root: string) {
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.notEqual(result.status, 0);
    // The reader reports a truncated config with the compiler's own TS1005
    // wording, at the line and column where the text ended.
    assert.match(result.stderr, /'\}' expected \(line 1 column \d+\)/);
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  },
};

/**
 * Verifies compiler corpus: a malformed tsconfig is rejected before any emit.
 *
 * A truncated JSON tsconfig (missing closing braces) must cause the compiler to
 * fail with a parse error before touching `outDir`. Without this guard a
 * corrupted tsconfig could silently fall back to default options and write
 * output to unexpected locations. Pins the early-rejection path so the project
 * directory stays clean on bad config.
 *
 * 1. Create a project with a truncated `tsconfig.json`.
 * 2. Run `ttsc --emit`.
 * 3. Assert non-zero exit, a JSON parse error on stderr, and no `dist/main.js`.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs ttsc emit on a truncated config and a valid console.log source; asserts nonzero status, compiler closing-brace diagnostic with location and no dist/main.js.
 * @evidence contracts/testing.md#independent-expectations Malformed configuration must fail before selecting an emission policy. Authored missing braces and compiler parse diagnostic meaning specify the error independently; only the expected dist path is checked for absence.
 * @evidence contracts/testing.md#distinguishing-cases Owns truncated JSON configuration contrasted with a valid source, distinguishing configuration rejection from TypeScript source errors owned by the syntax/semantic entries.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_invalid_tsconfig_is_rejected_before_emit is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary The CLI config reader must surface its parse failure and gate the real emit path; checking parsed values alone would miss launcher fallback or filesystem output.
 * @evidence contracts/e2e.md#shared-execution One failing CLI invocation batches error status, diagnostic and output suppression. Built launcher is shared; failure before compilation needs no plugin/native producer build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh source/config paths contain no old output, and the process is joined before assertions. TestProject removes the fixture at worker exit; no shared cache reset is necessary.
 * @evidence contracts/e2e.md#preserved-coverage Nonzero exit, closing-brace/location regex and output absence remain in project.run. The case does not enumerate every malformed JSON form or all possible misplaced output paths.
 */
export const test_compiler_corpus_invalid_tsconfig_is_rejected_before_emit =
  (): void => {
    const root = project.root();
    project.run(root);
  };
