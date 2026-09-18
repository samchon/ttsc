import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies every token after the entry reaches the program's `process.argv`,
 * terminal flags and inner separators included, while options before the entry
 * still belong to ttsx.
 *
 * Pins samchon/ttsc#1401. The launcher scanned the whole argv for `--help` and
 * `--version`, so `ttsx server.ts --version` printed ttsx's version and never
 * ran the program; and it split argv on the first `--` anywhere, so a `--` the
 * program expected vanished. Only the part before the entry is the launcher's,
 * as with `node`: after it, tokens pass through verbatim, except that one `--`
 * directly after the entry is still the documented optional separator.
 *
 * 1. Create an entry that prints its argv as JSON.
 * 2. Run it with `--help`, `-h`, `--version`, `-v`, `a -- b`, `-- --port 3000`,
 *    and `-- -- x` after the entry.
 * 3. Assert each argv exactly, then assert `--version` and `--help` before the
 *    entry still answer for ttsx itself.
 */
export const test_ttsx_hands_every_token_after_the_entry_to_the_program =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "argv", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      }),
      "src/args.ts": [
        `declare const process: { argv: string[] };`,
        `console.log(JSON.stringify(process.argv.slice(2)));`,
        `export {};`,
        ``,
      ].join("\n"),
    });
    const run = (args: string[]) =>
      TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, ...args], {
        cwd: root,
      });

    for (const [tail, expected] of [
      [["--help"], ["--help"]],
      [["-h"], ["-h"]],
      [["--version"], ["--version"]],
      [["-v"], ["-v"]],
      [["a", "--", "b"], ["a", "--", "b"]],
      [["--", "--port", "3000"], ["--port", "3000"]],
      [["--", "--", "x"], ["--", "x"]],
    ] as const) {
      const result = run(["src/args.ts", ...tail]);
      assert.equal(result.status, 0, `${tail.join(" ")}: ${result.stderr}`);
      assert.deepEqual(
        JSON.parse(result.stdout.trim()),
        expected,
        tail.join(" "),
      );
    }

    const version = run(["--version", "src/args.ts"]);
    assert.equal(version.status, 0, version.stderr);
    assert.match(version.stdout, /^ttsx /);
    const help = run(["--help"]);
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /Usage:/);
  };
