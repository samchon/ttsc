import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx refuses `--watch` before the entry at once, and hands it to
 * the program after the entry.
 *
 * Pins samchon/ttsc#1409. `--watch` before the entry was forwarded to the
 * type-check, which then never returned: the entry never ran and the command
 * hung with no output. ttsx runs the entry once after one check, so the flag is
 * refused before any compiler starts, with the two tools that already cover a
 * watching check and a restarting program. After the entry it is the
 * program's own argument (samchon/ttsc#1401).
 *
 * 1. Create an entry that prints its argv.
 * 2. Run `ttsx --watch src/args.ts` and `ttsx -w src/args.ts` with a timeout,
 *    then `ttsx src/args.ts --watch`.
 * 3. Assert both refusals exit 2 promptly with a message naming the flag and
 *    the alternatives, and the last run prints `--watch` as program argv.
 */
export const test_ttsx_refuses_watch_before_the_entry = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ name: "no-watch", private: true }),
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

  for (const flag of ["--watch", "-w"]) {
    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, flag, "src/args.ts"],
      { cwd: root, timeout: 60_000 },
    );
    assert.equal(result.status, 2, `${flag}: ${result.stdout}${result.stderr}`);
    assert.match(result.stderr, /--watch is not supported/);
    assert.match(result.stderr, /ttsc --watch --noEmit/);
    assert.match(result.stderr, /node --watch --require ttsc\/register/);
  }

  const program = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/args.ts", "--watch"],
    { cwd: root, timeout: 60_000 },
  );
  assert.equal(program.status, 0, program.stderr);
  assert.deepEqual(JSON.parse(program.stdout.trim()), ["--watch"]);
};
