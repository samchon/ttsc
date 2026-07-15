import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs the entry when space-valued tsgo flags precede it and
 * keeps the program tail out of tsgo.
 *
 * With `forwardAfterFirstPositional`, the old parser treated the `es2020` of a
 * pre-entry `--target es2020` as the first positional sentinel, so the real
 * entry was routed into the program tail and ttsx died with "entry file is
 * required" before ever invoking tsgo. The entry must instead be found after
 * the forwarded pairs, and post-entry tokens must reach the program's argv,
 * never tsgo's option parser.
 *
 * 1. Create a CJS entry that prints `process.argv.slice(2)` as JSON.
 * 2. Run `ttsx --target es2020 --module commonjs src/main.ts alpha beta`.
 * 3. Assert a zero exit, no "entry file is required" / "Unknown compiler option",
 *    and that the entry received exactly `["alpha", "beta"]`.
 */
export const test_ttsx_runs_the_entry_after_spaced_tsgo_flag_values = () => {
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": [
      `declare const process: { argv: string[] };`,
      `console.log(JSON.stringify(process.argv.slice(2)));`,
      ``,
    ].join("\n"),
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    [
      "--cwd",
      root,
      "--target",
      "es2020",
      "--module",
      "commonjs",
      "src/main.ts",
      "alpha",
      "beta",
    ],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(
    `${result.stdout}${result.stderr}`,
    /entry file is required|Unknown compiler option/i,
  );
  assert.deepEqual(JSON.parse(result.stdout.trim()), ["alpha", "beta"]);
};
