import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: @ttsc/lint failure does not duplicate TypeScript
 * diagnostics.
 *
 * `@ttsc/lint` reports normal Program diagnostics together with its own rule
 * findings. The post-failure TypeScript guard must recognize that TS2322 is
 * already present and avoid appending the same diagnostic a second time while
 * preserving the lint failures in the shared stream.
 *
 * 1. Copy the lint-violations fixture and add a genuine TS2322 assignment.
 * 2. Run ttsc with `--noEmit` so @ttsc/lint reports both diagnostic families.
 * 3. Assert lint output remains present and TS2322 occurs exactly once.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual lint failure carries no-var and a genuine TS2322 once through the compiler failure path.
 * @evidence contracts/testing.md#independent-expectations The incompatible string assignment to number independently requires TS2322; exactly one diagnostic and a no-var finding establish both diagnostic families survive.
 * @evidence contracts/testing.md#distinguishing-cases Owns simultaneous native lint and compiler diagnostics with duplicate suppression, complementing the clean diagnostics-capability control.
 * @evidence contracts/testing.md#execution-ownership The matching named corpus-ttsc export executes the actual CLI and native renderer in the shared Linux batch.
 * @evidence contracts/e2e.md#necessary-boundary The post-plugin failure guard must recognize diagnostics already emitted by the actual producer; isolated renderer or rule units do not prove this handoff.
 * @evidence contracts/e2e.md#shared-execution The canonical lint producer and plugin cache are shared with strict/fix/format boundaries; no new contributor compilation is needed for the appended consumer source.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity An isolated source fixture receives its own incompatible assignment, and only immutable native producer artifacts are reused; process output is local to this invocation.
 * @evidence contracts/e2e.md#preserved-coverage All original assertions remain: failed exit, no-var presence and TS2322 count exactly one. Portable rule semantics remain in their Go owners.
 */
export function test_plugin_corpus_ttsc_lint_failure_does_not_duplicate_typescript_diagnostics(): void {
  const root = setupLintProject("lint-violations");
  fs.appendFileSync(
    path.join(root, "src", "main.ts"),
    '\nconst wrong: number = "type-error";\nvoid wrong;\n',
    "utf8",
  );
  const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /\[no-var\]/);
  assert.equal(result.stderr.match(/TS2322/g)?.length, 1, result.stderr);
}
