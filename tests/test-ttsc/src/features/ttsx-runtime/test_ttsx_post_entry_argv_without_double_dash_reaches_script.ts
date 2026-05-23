import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx routes post-entry argv to the user script when no `--`
 * separator is present.
 *
 * Commit 502942b on PR #124 fixed a regression CI caught: the schema-based
 * parser was bundling every token after the entry file into
 * `result.passthrough`, which `runTtsx::parseCLI` then forwarded to tsgo as
 * `tsgoFlags`. So `ttsx typia.ts generate --input X` exited 2 with
 * "Unknown compiler option '--input'" from tsgo instead of reaching the
 * entry's `process.argv`. The sibling test
 * `test_ttsx_forwards_argv_after_and_runs_preload_modules` only exercises
 * the `--` separator path; this case pins the no-`--` path the typia
 * fixture actually trips, so the original regression cannot recur.
 *
 * 1. Create a CJS entry that prints `process.argv.slice(2)` as JSON.
 * 2. Run `ttsx src/main.ts generate --input X --output Y` with NO `--`.
 * 3. Assert zero exit and that the entry received the full tail
 *    `["generate", "--input", "X", "--output", "Y"]` — confirming the
 *    `tail` sink in `parseFlags` (added by 502942b) keeps script argv out
 *    of `tsgoFlags`.
 */
export const test_ttsx_post_entry_argv_without_double_dash_reaches_script =
  () => {
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
      "src/main.ts": `
        declare const process: { argv: string[] };
        console.log(JSON.stringify({ argv: process.argv.slice(2) }));
      `,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      [
        "--cwd",
        root,
        "src/main.ts",
        "generate",
        "--input",
        "X",
        "--output",
        "Y",
      ],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(
      `${result.stdout}${result.stderr}`,
      /Unknown compiler option/i,
    );
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      argv: ["generate", "--input", "X", "--output", "Y"],
    });
  };
