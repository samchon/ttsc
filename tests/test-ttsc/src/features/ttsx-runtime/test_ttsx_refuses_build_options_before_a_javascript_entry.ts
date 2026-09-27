import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx refuses the options that configure a TypeScript entry's
 * up-front build when the entry is JavaScript, rather than ignoring them.
 *
 * A JavaScript entry has no up-front project build: each TypeScript file it
 * reaches is built through its own project (samchon/ttsc#1569). `--project`,
 * a forwarded compiler option such as `--strict`, `--no-plugins` and the rest
 * would change nothing, so a run that accepted them would silently differ
 * from what was asked. A TypeScript entry keeps accepting them.
 *
 * 1. Give a project a JavaScript `script.js` and a TypeScript `entry.ts`.
 * 2. Run `ttsx --strict script.js` and `ttsx -P tsconfig.json script.js`.
 * 3. Assert both exit 2 naming the option and never run the script, while
 *    `ttsx --strict entry.ts` runs.
 */
export const test_ttsx_refuses_build_options_before_a_javascript_entry =
  () => {
    const root = TestProject.commonJsProject({
      "script.js": `console.log("ran");\n`,
      "src/entry.ts": `console.log("ran");\n`,
    });

    for (const [args, option] of [
      [["--strict", "script.js"], "--strict"],
      [["-P", "tsconfig.json", "script.js"], "--project"],
    ] as const) {
      const result = TestProject.spawn(TestProject.TTSX_BIN, [...args], {
        cwd: root,
      });
      assert.equal(result.status, 2, args.join(" "));
      assert.match(result.stderr, new RegExp(`ttsx: .*${option}`));
      assert.match(result.stderr, /script\.js is JavaScript/);
      assert.doesNotMatch(result.stdout, /ran/);
    }

    const typescript = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--strict", "src/entry.ts"],
      { cwd: root },
    );
    assert.equal(typescript.status, 0, typescript.stderr);
    assert.equal(typescript.stdout.trim(), "ran");
  };
