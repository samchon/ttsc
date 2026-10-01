import {
  assert,
  assertNoProjectAbove,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies the terminal flags that describe a project still fail without one.
 *
 * Answering a terminal flag before project resolution is correct only for the
 * flags whose meaning precedes a project. `--showConfig` and `--listFilesOnly`
 * print a _resolved project_, so failing without one is the right answer and
 * the project-free branch must not swallow them. The negative twin of
 * `test_ttsc_init_writes_a_tsconfig_outside_a_project`; a bare `ttsc` is the
 * control.
 *
 * 1. Materialize a directory with no config and assert no ancestor carries one.
 * 2. Run `ttsc --showConfig`, `ttsc --listFilesOnly`, and a bare `ttsc` there.
 * 3. Assert each still exits 2 with ttsc's project-not-found message.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs --showConfig, --listFilesOnly and ordinary build outside a project; requires status2 and the specific missing tsconfig/jsconfig message for all three.
 * @evidence contracts/testing.md#independent-expectations These operations describe or compile a project rather than global compiler help; missing authored config independently requires project discovery failure.
 * @evidence contracts/testing.md#distinguishing-cases Config listing, file listing and default command contrast with project-independent help flags and retain their own failure identities.
 * @evidence contracts/testing.md#execution-ownership The named feature is discovered by TestExecutor and executes three actual launcher entrypoints.
 * @evidence contracts/e2e.md#necessary-boundary Real CLI admission must fail before tsgo project operations run in an unowned cwd; pure option classification cannot prove status and stderr behavior.
 * @evidence contracts/e2e.md#shared-execution Three commands share one verified nonproject fixture and built executables; differing argv entrypoints need separate process lifetimes but no installation or Go build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity assertNoProjectAbove verifies fixture ancestry before commands; each synchronous child completes and TestProject removes the registered root at suite exit.
 * @evidence contracts/e2e.md#preserved-coverage Every original status2/missing-project predicate remains for all three calls. Exact absolute error-path text is not asserted.
 */
export const test_ttsc_project_describing_terminal_flags_still_require_a_project =
  () => {
    const root = createProject({ "src/main.ts": `export const value = 1;\n` });
    assertNoProjectAbove(root);

    for (const argv of [["--showConfig"], ["--listFilesOnly"], []]) {
      const result = spawn(ttscBin, ["--cwd", root, ...argv], { cwd: root });
      const output = `${result.stdout}${result.stderr}`;
      assert.equal(result.status, 2, `ttsc ${argv.join(" ")}:\n${output}`);
      assert.match(
        output,
        /ttsc: could not find tsconfig\.json or jsconfig\.json starting from /,
      );
    }
  };
