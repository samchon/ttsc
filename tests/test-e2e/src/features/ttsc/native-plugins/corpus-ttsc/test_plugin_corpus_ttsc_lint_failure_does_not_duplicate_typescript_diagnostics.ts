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
 * @evidence contracts/testing.md#independent-expectations The incompatible string assignment to number independently requires TS2322; one literal TS2322 occurrence and no-var marker establish the asserted diagnostic-family observations, not a complete parsed finding inventory.
 * @evidence contracts/testing.md#distinguishing-cases Owns simultaneous native lint and compiler diagnostics with duplicate suppression, complementing the clean diagnostics-capability control.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named corpus-ttsc export in the generic E2E population; the public CLI uses the workspace-linked native lint producer. Body presence is not execution or a packed installation/Linux-only selection claim.
 * @evidence contracts/e2e.md#necessary-boundary The post-plugin failure guard must recognize diagnostics already emitted by the actual producer; isolated renderer or rule units do not prove this handoff.
 * @evidence contracts/e2e.md#shared-execution The unchanged canonical lint producer and explicit suite-owned plugin cache are available for reuse across strict/fix/format consumers. This output does not certify that no compilation occurred, count actual processes, prove a hit or establish minimum preparation cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked consumer receives its own incompatible assignment and invocation-local output; producer/cache are not consumer cleanup targets. Error, signal and numeric nonzero status distinguish actual product failure from failed launch. Synchronous return does not certify arbitrary descendants or loaded-image equality.
 * @evidence contracts/e2e.md#preserved-coverage Original failed exit, no-var marker and TS2322 occurrence count exactly one remain. Portable rule meanings retain separate exact direct-unit selection/survival obligations; this stream is not proof those owners executed or that every lint finding was retained.
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

  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(typeof result.status, "number");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /\[no-var\]/);
  assert.equal(result.stderr.match(/TS2322/g)?.length, 1, result.stderr);
}
