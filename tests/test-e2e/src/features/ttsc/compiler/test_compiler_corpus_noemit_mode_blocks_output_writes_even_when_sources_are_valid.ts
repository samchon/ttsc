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
  name: "noEmit mode blocks output writes even when sources are valid",
  root: () =>
    commonJsProject(FixtureFiles.read("ttsc/compiler_corpus_noemit_mode_blocks_output_writes_even_when_sources_are_valid/inputs-1")),
  run(root: string) {
    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], { cwd: root });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  },
};

/**
 * Verifies compiler corpus: `--noEmit` blocks output writes even when sources
 * are valid.
 *
 * `--noEmit` is used by CI check-only passes that must not write artifacts.
 * Pins that the flag fully suppresses emission through the CLI even when the
 * TypeScript is clean; without this guard a codepath could treat `--noEmit` as
 * advisory and still write to `outDir`.
 *
 * 1. Create a valid CommonJS project.
 * 2. Run `ttsc --cwd <root> --noEmit`.
 * 3. Assert exit 0 and that `dist/main.js` was not written to disk.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs project-mode ttsc noEmit on a valid string-valued CommonJS project; asserts zero exit and no dist/main.js.
 * @evidence contracts/testing.md#independent-expectations noEmit requests analysis without user-tree JavaScript output. A known-valid source and literal absent output distinguish successful checking from ordinary emission without deriving the expectation from compiler results.
 * @evidence contracts/testing.md#distinguishing-cases Owns clean project-mode suppression; emit=false, noEmit=false and failed source diagnostics are covered by other corpus entries.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_noemit_mode_blocks_output_writes_even_when_sources_are_valid is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary The CLI noEmit option must reach native project checking and suppress the writer despite successful compilation. Direct parser/options units cannot prove the output boundary.
 * @evidence contracts/e2e.md#shared-execution One CLI invocation combines valid checking and suppressed output. Built launcher/native toolchain preparation is shared, with no plugin binary or separate runtime child.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh configured dist tree cannot hide a stale emit from this command. Synchronous completion precedes inspection and TestProject removes the project at worker exit.
 * @evidence contracts/e2e.md#preserved-coverage Exit success and expected JavaScript absence remain in project.run. The check covers main.js rather than asserting that every possible filesystem entry is unchanged.
 */
export const test_compiler_corpus_noemit_mode_blocks_output_writes_even_when_sources_are_valid =
  (): void => {
    const root = project.root();
    project.run(root);
  };
