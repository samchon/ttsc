import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies an entry outside the project's `include` is still type-checked
 * before it runs.
 *
 * The negative twin of running an excluded entry. The cheap way to make such an
 * entry executable would be to type-strip it and skip the check, which would
 * silently drop ttsx's whole promise — "run a TypeScript file, but type-check
 * first" — for exactly the scripts a project keeps outside `src`. The entry is
 * compiled through a real project instead, so its own diagnostics stop the run,
 * and the message names the entry rather than the internal "emitted entry not
 * found" that used to surface here.
 *
 * 1. Create a project with `include: ["src"]` and a root-level script with a type
 *    error.
 * 2. Run ttsx against that script.
 * 3. Assert the run fails, reports the entry's own diagnostic, and never executes
 *    the script's side effect.
 */
export const test_ttsx_reports_a_type_error_in_an_entry_the_project_include_excludes =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        name: "excluded-error",
        version: "1.0.0",
      }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/index.ts": `export const hello = (): string => "world";\n`,
      "clear.ts": `const broken: number = "not a number";\nconsole.log("must-not-run", broken);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "clear.ts"],
      { cwd: root },
    );
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout.includes("must-not-run"), false);
    const output = `${result.stderr}${result.stdout}`;
    assert.equal(output.includes("clear.ts"), true, output);
    assert.equal(output.includes("emitted entry not found"), false, output);
  };
