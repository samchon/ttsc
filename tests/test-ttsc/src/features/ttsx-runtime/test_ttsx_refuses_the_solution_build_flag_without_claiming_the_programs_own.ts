import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx refuses `--build` in its own voice, and still hands the entry
 * program a `--build` of its own.
 *
 * `ttsc` refuses the flag because every build lane pins one resolved project
 * ahead of the forwarded argv, and `ttsx` reaches tsgo through that same lane —
 * left forwarded, it produced the identical TS6369 telling the user the flag
 * must come first when they had already put it first. The refusal cannot be
 * unconditional, though: `ttsx` parses with `forwardAfterFirstPositional`, so a
 * token after the entry belongs to the program being run and must survive
 * untouched. Both halves are asserted here because a fix for one silently
 * breaks the other (issue #1173).
 *
 * 1. Build a project whose entry prints the argv it received.
 * 2. Run ttsx with `--build` before the entry, and again with `--build` after it.
 * 3. Assert the first is refused by ttsx with no TS6369, and the second runs and
 *    reports `--build` as the program's own argument.
 */
export const test_ttsx_refuses_the_solution_build_flag_without_claiming_the_programs_own =
  () => {
    const root = TestProject.commonJsProject({
      "src/main.ts": [
        `declare const process: { argv: string[] };`,
        ``,
        `console.log(JSON.stringify(process.argv.slice(2)));`,
        ``,
      ].join("\n"),
    });

    const refused = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "--build", "src/main.ts"],
      { cwd: root },
    );
    const output = `${refused.stdout}${refused.stderr}`;
    assert.notEqual(refused.status, 0, output);
    assert.match(output, /ttsx: --build \(solution mode\) is not supported/);
    assert.equal(
      output.includes("TS6369"),
      false,
      `ttsx forwarded --build to tsgo instead of refusing it: ${output}`,
    );

    const forwarded = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts", "--build"],
      { cwd: root },
    );
    assert.equal(forwarded.status, 0, `${forwarded.stdout}${forwarded.stderr}`);
    assert.deepEqual(JSON.parse(forwarded.stdout.trim()), ["--build"]);
  };
