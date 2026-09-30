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
 * The error is one only `strict` produces: `null` is assignable to `number`
 * without it. So this also pins that the synthesized entry project inherits the
 * real tsconfig's options rather than compiling under a default set — if it
 * dropped them, this entry would compile and run.
 *
 * 1. Create a project with `strict`, `include: ["src"]`, and a root-level script
 *    whose only error requires `strict` to exist.
 * 2. Run ttsx against that script.
 * 3. Assert the run fails, reports the entry's own diagnostic, and never executes
 *    the script's side effect.
 * @evidence contracts/testing.md#behavioral-verification Runs excluded clear.ts containing number = null and requires failure, no must-not-run marker, clear.ts in output and no entry-not-found fallback.
 * @evidence contracts/testing.md#independent-expectations The source authors its filename and effect marker; the current oracle does not require the actual null assignability diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases An excluded invalid entry must fail before execution, but another failure naming clear.ts could also satisfy the present assertions.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_reports_a_type_error_in_an_entry_the_project_include_excludes at this path, selected by tests/e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Actual entry checking and Node effect gating cross the excluded-source compiler/runtime boundary.
 * @evidence contracts/e2e.md#shared-execution One project and one host own this negative entry; installed compiler preparation can be reused without changing the source state.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The immutable invalid fixture has tracked temporary ownership and its child finishes before stdout/stderr checks.
 * @evidence contracts/e2e.md#preserved-coverage Every current failure/name/effect assertion remains here; exact diagnostic-cause coverage is an unresolved limitation.
 */
export function test_ttsx_reports_a_type_error_in_an_entry_the_project_include_excludes() {
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
      "clear.ts": `const broken: number = null;\nconsole.log("must-not-run", broken);\n`,
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
  }
