import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs a root outside `include` that imports both its own
 * project's sources and a sibling package's source, in a `composite` project.
 *
 * A root no build covered is compiled alone through its project's options
 * (samchon/ttsc#1382), and three of those options could reject any program such
 * a root has. `composite` requires every file of the program to be listed,
 * which a build listing only the root cannot satisfy (TS6307). Switching it off
 * leaves an inherited `declarationMap` without the `declaration` it needs
 * (TS5069). And a `rootDir` narrower than the source's volume leaves out a
 * sibling package the root imports (TS6059). The runtime build switches
 * `composite` and declarations off and roots its private layout at the volume,
 * so none applies.
 *
 * 1. Create a `composite` project with `include: ["src"]`, a script outside it
 *    that imports `../src/lib` and `../../shared/value`, and the sibling
 *    `shared/value.ts` outside the project directory.
 * 2. Run the script as the entry, then run an entry that requires it.
 * 3. Assert both runs print the combined value.
 * @evidence contracts/testing.md#behavioral-verification Runs an excluded report as entry and through an included main; both import included lib and a workspace file outside the composite app and print lib+shared.
 * @evidence contracts/testing.md#independent-expectations Authored lib and shared values independently define the combined output for both launch paths.
 * @evidence contracts/testing.md#distinguishing-cases Composite/rootDir restrictions must not block the excluded report graph; the two-case loop stops before the second run if the first fails.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_runs_a_root_that_imports_beyond_a_composite_project at this path, selected by tests/test-scripts-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Actual compiler handling of composite ownership and Node import execution crosses both included and outside-project source boundaries.
 * @evidence contracts/e2e.md#shared-execution One workspace graph and compiler serve two hosts; the source fixtures and options can be shared without rebuilding a plugin producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Inputs remain immutable between synchronous runs; the tracked workspace lasts until process-exit cleanup and owned-output cleanup is not inspected.
 * @evidence contracts/e2e.md#preserved-coverage Both exact lib+shared assertions remain here; no cache-release or declaration-output preservation claim is added.
 */
export function test_ttsx_runs_a_root_that_imports_beyond_a_composite_project() {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "workspace", private: true }),
      "shared/value.ts": `export const shared: string = "shared";\n`,
      "app/package.json": JSON.stringify({ name: "app", private: true }),
      "app/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          composite: true,
          declarationMap: true,
          outDir: "lib",
          rootDir: "src",
          types: [],
        },
        include: ["src"],
      }),
      "app/src/lib.ts": `export const lib: string = "lib";\n`,
      "app/src/main.ts": [
        `declare const require: (id: string) => unknown;`,
        `require("../scripts/report.ts");`,
        `export {};`,
        ``,
      ].join("\n"),
      "app/scripts/report.ts": [
        `import { lib } from "../src/lib";`,
        `import { shared } from "../../shared/value";`,
        `console.log(lib + "+" + shared);`,
        ``,
      ].join("\n"),
    });
    const app = `${root}/app`;

    for (const entry of ["scripts/report.ts", "src/main.ts"]) {
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", app, entry],
        { cwd: app },
      );
      assert.equal(result.status, 0, `${entry}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), "lib+shared", entry);
    }
  }
