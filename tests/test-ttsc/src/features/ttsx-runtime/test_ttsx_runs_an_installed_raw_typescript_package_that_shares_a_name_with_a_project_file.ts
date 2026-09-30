import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs an installed package's own raw TypeScript when a project
 * file shares its name.
 *
 * Pins samchon/ttsc#1382 row 5, the most common shape of the defect: any
 * project with `src/index.ts` that installs a package shipping `index.ts`
 * source. With no `rootDir`, the project's source root contains `node_modules`,
 * so the entry build claimed the package file and served the `src/index.js`
 * whose name matched: the project's entry ran a second time as the package, and
 * the package's exports read as `undefined`. The package has no tsconfig of its
 * own, so the file belongs to the isolated orphan lane.
 *
 * 1. Create a project with `src/index.ts` and `src/main.ts`, and an installed
 *    `rawpkg` whose `main` is its own `index.ts`.
 * 2. Run `src/main.ts`, which requires `rawpkg`.
 * 3. Assert the package's own value arrives and the project's `src/index.ts` never
 *    runs.
 * @evidence contracts/testing.md#behavioral-verification Requires a raw installed package index beside the consumer src/index and requires rawpkg=package-own without the project index value.
 * @evidence contracts/testing.md#independent-expectations The authored package-own and project-index markers independently distinguish the two same-basename source owners.
 * @evidence contracts/testing.md#distinguishing-cases The package has no own config and must be lowered from its own source, rather than borrowing the checked project index emit.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_runs_an_installed_raw_typescript_package_that_shares_a_name_with_a_project_file at this path, selected by tests/e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Actual no-config package fallback and Node require connect raw installed TypeScript to source-specific runtime ownership.
 * @evidence contracts/e2e.md#shared-execution One consumer graph and one host reuse compiler preparation; this is not an independently installed consumer per assertion.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Package and consumer source bytes remain immutable during the child, with tracked temporary ownership through process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The exact rawpkg=package-own assertion remains here; similarly named ownership units are not assumed to cover this native package load.
 */
export function test_ttsx_runs_an_installed_raw_typescript_package_that_shares_a_name_with_a_project_file() {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "consumer", private: true }),
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
      "src/index.ts": `console.log("project index ran");\nexport {};\n`,
      "src/main.ts": [
        `declare const require: (id: string) => { marker: string };`,
        `console.log("rawpkg=" + require("rawpkg").marker);`,
        `export {};`,
        ``,
      ].join("\n"),
      "node_modules/rawpkg/package.json": JSON.stringify({
        name: "rawpkg",
        version: "1.0.0",
        main: "index.ts",
      }),
      "node_modules/rawpkg/index.ts": `export const marker: string = "package-own";\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "rawpkg=package-own");
  }
