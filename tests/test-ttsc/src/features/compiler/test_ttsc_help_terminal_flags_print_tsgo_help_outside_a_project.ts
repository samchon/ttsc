import {
  assert,
  assertNoProjectAbove,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

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
 */
export const test_ttsc_help_terminal_flags_print_tsgo_help_outside_a_project =
  () => {
    const root = createProject({ "src/main.ts": `export const value = 1;\n` });
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
