import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  assertNoProjectAbove,
  createProject,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies `ttsc --all` and `ttsc -?` print tsgo's help without a project.
 *
 * Both only ask tsgo to print something and exit, but the launcher resolved a
 * project first and unconditionally, so both died with ttsc's "could not find
 * tsconfig.json …" error outside an existing project. `-?` is tsgo's synonym
 * for `--help` and ttsc owns `--help` itself, so it is declared as its own
 * schema row rather than as an alias — that keeps it forwarding to tsgo while
 * still carrying the terminal and project-free classifications.
 *
 * 1. Materialize a directory with no config and assert no ancestor carries one.
 * 2. Run `ttsc --all`, `ttsc -?`, and the `build --all` subcommand form there.
 * 3. Assert each exits 0 with tsgo's help and no project-resolution error.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs --all, -? and build --all outside any project; requires successful TypeScript Compiler help without missing-config errors.
 * @evidence contracts/testing.md#independent-expectations Terminal help describes the compiler independently of a project; authored argv forms establish which calls must bypass project lookup.
 * @evidence contracts/testing.md#distinguishing-cases Long flag, short alias and explicit build command share the nonproject state. Project-describing terminal flags have the opposite expectation in another entry.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this compiler feature and runs three actual ttsc command invocations.
 * @evidence contracts/e2e.md#necessary-boundary Help flags must reach tsgo through the launcher before project resolution rejects the cwd; direct option classification cannot prove actual forwarded help output.
 * @evidence contracts/e2e.md#shared-execution All three commands share one nonproject fixture and built executables. Separate argv entrypoints require separate command lifetimes but no install or native build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity assertNoProjectAbove validates the fresh fixture ancestry, preventing repository or ambient configs from satisfying lookup; synchronous commands complete and suite cleanup owns the directory.
 * @evidence contracts/e2e.md#preserved-coverage All three status/help/forbidden-error checks remain. Exact full help text and version are deliberately not asserted.
 */
export const test_ttsc_help_terminal_flags_print_tsgo_help_outside_a_project =
  () => {
    const root = createProject(FixtureFiles.read("ttsc/ttsc_help_terminal_flags_print_tsgo_help_outside_a_project/inputs-1"));
    assertNoProjectAbove(root);

    for (const argv of [["--all"], ["-?"], ["build", "--all"]]) {
      const result = spawn(ttscBin, ["--cwd", root, ...argv], { cwd: root });
      const output = `${result.stdout}${result.stderr}`;
      assert.equal(result.status, 0, `ttsc ${argv.join(" ")}:\n${output}`);
      assert.match(output, /TypeScript Compiler/);
      assert.equal(
        /could not find tsconfig\.json/.test(output),
        false,
        `ttsc ${argv.join(" ")} must not resolve a project:\n${output}`,
      );
    }
  };
