import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies ttsc rejects `fix` combined with --watch.
 *
 * Watch mode rebuilds on file changes, so combining it with a one-shot
 * source-rewriting pass would loop the watcher against its own edits. The
 * launcher refuses the combination before any plugin spawns; this test pins the
 * user-facing error message and exit path.
 *
 * 1. Materialize a minimal tsconfig project.
 * 2. Run `ttsc fix --watch` through the real launcher.
 * 3. Assert non-zero exit and the documented refusal message on stderr.
 *
 * @evidence contracts/testing.md#behavioral-verification The real CLI refuses fix --watch before a compiler host starts and publishes the documented message with failing exit status.
 * @evidence contracts/testing.md#independent-expectations Literal refusal text and expected failing exit define the process oracle; the complete six mode decisions and valid controls are independently asserted by the authored mode-adapter unit.
 * @evidence contracts/testing.md#distinguishing-cases This case owns failure transport through the installed launcher, while emit/watch/single-file branches for both commands and their precedence are exercised directly in the source unit.
 * @evidence contracts/testing.md#execution-ownership The named compiler export is selected once, owns one temporary consumer project and invokes one CLI refusal process.
 * @evidence contracts/e2e.md#necessary-boundary Pure mode units cannot observe the launcher catching its exception, printing stderr and returning a failing process exit, so one representative assembly refusal remains.
 * @evidence contracts/e2e.md#shared-execution Five redundant command refusal subprocesses are replaced by one source-unit table; this single CLI call verifies their shared top-level exception transport.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The project and source are local immutable inputs, no contributor binary is prepared, and validation fails before watch resources are acquired.
 * @evidence contracts/e2e.md#preserved-coverage Retains the original fix-watch stderr and exit assertions; the other five exact original refusal inputs now use production parseTtscBuildArgs and prepareTtscBuildMode with complete messages, valid controls and conflict precedence.
 */
export function test_ttsc_rejects_fix_with_watch_mode(): void {
  const root = createProject(FixtureFiles.read("ttsc/ttsc_rejects_fix_with_watch_mode/inputs-1"));

  const result = spawn(ttscBin, ["fix", "--watch", "--cwd", root], {
    cwd: root,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fix does not support watch mode/);
}
