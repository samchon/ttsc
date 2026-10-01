import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies a user-supplied `--outDir` on a project without `rootDir` still gets
 * tsgo's own answer, whatever that answer is.
 *
 * The runner and single-file lanes pin an inferred `rootDir` because the
 * `outDir` they compile against is one ttsc injected for its own private
 * output. A `--outDir` the user typed is the opposite: it is the user's own
 * request, and tsgo's layout diagnostic for it belongs to the user. This is the
 * boundary the fix must not cross, so the expectation is taken from tsgo at run
 * time rather than written down here (issue #1172).
 *
 * 1. Build an emitting project with a nested source and no `rootDir`.
 * 2. Run the pinned tsgo with `--outDir`, then ttsc with the same `--outDir`.
 * 3. Assert ttsc agrees with tsgo on success and on naming `rootDir`.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs direct tsgo and ttsc with separate output directories on the same no-rootDir project, comparing success versus failure and rootDir diagnostic presence.
 * @evidence contracts/testing.md#independent-expectations The direct upstream compiler invocation supplies the independent layout-policy oracle; expectations compare outcomes rather than duplicate ttsc rootDir inference.
 * @evidence contracts/testing.md#distinguishing-cases Explicit outDir with absent rootDir is the boundary layout condition; ordinary configured rootDir/outDir publication is covered by neighboring entries.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this compiler feature and runs both the upstream reference command and product launcher.
 * @evidence contracts/e2e.md#necessary-boundary The launcher must preserve the upstream compiler answer for its actual project/argv, a connection unit inference cannot prove.
 * @evidence contracts/e2e.md#shared-execution One project is shared by both commands; distinct oracle-dist/ttsc-dist roots prevent output overlap, while the upstream reference invocation is necessary for the chosen independent oracle.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject registers the project and owns both result roots; each synchronous command completes before boolean/status comparison and suite cleanup removes all fixture state.
 * @evidence contracts/e2e.md#preserved-coverage Original outcome agreement and rootDir-diagnostic agreement remain. Two equally successful commands with differently wrong emitted contents are not distinguished by this limited layout oracle.
 */
export const test_ttsc_outdir_flag_keeps_the_tsgo_answer_for_a_project_without_rootdir =
  () => {
    const root = TestProject.commonJsProject(
      {
        "src/main.ts": `export const value: string = "user-outdir";\n`,
      },
      {
        compilerOptions: {
          outDir: undefined,
          rootDir: undefined,
        },
      },
    );

    const oracle = TestProject.spawn(
      TestProject.TSGO_BINARY,
      ["-p", root, "--outDir", "oracle-dist"],
      { cwd: root },
    );
    const built = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--outDir", "ttsc-dist"],
      { cwd: root },
    );

    const oracleText = `${oracle.stdout}${oracle.stderr}`;
    const builtText = `${built.stdout}${built.stderr}`;
    assert.equal(
      built.status === 0,
      oracle.status === 0,
      `ttsc and tsgo disagree on --outDir\ntsgo: ${oracleText}\nttsc: ${builtText}`,
    );
    assert.equal(
      /rootDir/.test(builtText),
      /rootDir/.test(oracleText),
      `ttsc and tsgo disagree on the layout diagnostic\ntsgo: ${oracleText}\nttsc: ${builtText}`,
    );
  };
