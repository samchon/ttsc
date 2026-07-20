import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx still selects a project through the legacy uppercase `-P`.
 *
 * Ttsx has always accepted `-P` and `-P=<file>`, and used to get them by
 * rewriting the token to `--project` textually before the engine saw argv,
 * because the exact-spelling index could not resolve an uppercase alias. The
 * engine now resolves a token to the flag the compiler resolves it to, so the
 * rewrite was removed as a second rule for a job the engine owns. That makes
 * this an end-to-end guard rather than a parser detail: the spelling has to
 * keep selecting the project through the real launcher.
 *
 * 1. Create a project whose `alt/tsconfig.json` is the only one that declares the
 *    entry's directory, and whose entry prints a recognisable line.
 * 2. Run ttsx once with `-P alt/tsconfig.json` and once with the inline form.
 * 3. Assert both exit 0 and run the entry.
 */
export const test_ttsx_selects_the_project_through_the_legacy_uppercase_p_flag =
  () => {
    const root = TestProject.createProject({
      "alt/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "../dist",
          rootDir: "../src",
        },
        include: ["../src"],
      }),
      "src/main.ts": `console.log("ENTRY");\n`,
    });

    for (const project of ["alt/tsconfig.json", "-inline"]) {
      const args =
        project === "-inline"
          ? ["-P=alt/tsconfig.json"]
          : ["-P", "alt/tsconfig.json"];
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, ...args, "src/main.ts"],
        { cwd: root },
      );
      assert.equal(
        result.status,
        0,
        `ttsx ${args.join(" ")}:\n${result.stdout}${result.stderr}`,
      );
      assert.match(result.stdout, /ENTRY/);
    }
  };
