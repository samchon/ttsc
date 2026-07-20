import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies a `--require` written after the entry reaches the program instead of
 * preloading.
 *
 * The pre-entry boundary belongs to the parsing engine:
 * `forwardAfterFirstPositional` routes every post-entry token to the program's
 * argv without parsing it. Replacing the launcher's hand-written rescue scan
 * with the engine's own repeated-value list must preserve that, or `ttsx
 * entry.ts -r preload.cjs` would BOTH preload the module and forward the pair
 * to the entry, double-effecting the load. The negative twin of
 * `test_ttsx_preloads_every_require_spelling_before_the_entry`.
 *
 * 1. Create a preload that announces itself and an entry that prints its argv.
 * 2. Run `ttsx <entry> -r ./a.cjs`.
 * 3. Assert nothing was preloaded and the flag pair reached the program's argv.
 */
export const test_ttsx_does_not_preload_a_require_written_after_the_entry =
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
      "a.cjs": `console.log("PRELOAD a.cjs");\n`,
      "src/main.ts": `
        declare const process: { argv: string[] };
        console.log(JSON.stringify(process.argv.slice(2)));
      `,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts", "-r", "./a.cjs"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      /PRELOAD a\.cjs/.test(result.stdout),
      false,
      `a post-entry --require must not preload:\n${result.stdout}`,
    );
    assert.deepEqual(JSON.parse(result.stdout.trim()), ["-r", "./a.cjs"]);
  };
