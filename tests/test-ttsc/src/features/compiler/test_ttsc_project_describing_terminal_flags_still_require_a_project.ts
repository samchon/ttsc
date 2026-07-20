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
