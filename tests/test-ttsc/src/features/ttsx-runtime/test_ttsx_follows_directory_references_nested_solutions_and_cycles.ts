import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx finds a file's project through a directory reference, a nested
 * solution, and a reference cycle, both for the entry and for a source the
 * program requires from another solution.
 *
 * The owning project is chosen the way the language service chooses it
 * (samchon/ttsc#1406): a reference names a config file or a directory holding
 * `tsconfig.json`, a referenced solution is searched through its own
 * references, and a cycle is visited once instead of looping. The runtime's
 * dependency lane asks the same question for a file outside the entry's
 * program, so a required source in a solution-shaped package gets its real
 * project's options too. As in the entry case, the legacy decorator's three
 * arguments identify the project that enables `experimentalDecorators`.
 *
 * 1. Create a root solution referencing the directory `packages/app`, whose
 *    `tsconfig.json` is itself a solution referencing `tsconfig.lib.json` and,
 *    in a cycle, the root. Create a sibling `packages/dep` shaped the same way.
 * 2. Run `packages/app/src/main.ts`, which requires `packages/dep/src/value.ts`
 *    by path.
 * 3. Assert both files ran with legacy decorators.
 */
export const test_ttsx_follows_directory_references_nested_solutions_and_cycles =
  () => {
    const probe = (name: string): string =>
      [
        `let observed: number = 0;`,
        `function probe(...args: any[]): void {`,
        `  observed = args.length;`,
        `}`,
        `class Box {`,
        `  @probe`,
        `  method(): void {}`,
        `}`,
        `new Box();`,
        `export const ${name}: number = observed;`,
        ``,
      ].join("\n");
    const lib = JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        experimentalDecorators: true,
        types: [],
      },
      include: ["src"],
    });
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "nested", private: true }),
      "tsconfig.json": JSON.stringify({
        files: [],
        references: [{ path: "./packages/app" }, { path: "./packages/dep" }],
      }),
      "packages/app/tsconfig.json": JSON.stringify({
        files: [],
        references: [{ path: "../.." }, { path: "./tsconfig.lib.json" }],
      }),
      "packages/app/tsconfig.lib.json": lib,
      "packages/app/src/main.ts": [
        probe("entry"),
        `declare const require: (path: string) => { dependency: number };`,
        `const { dependency } = require("../../dep/src/value.ts");`,
        `console.log("entry=" + entry + " dependency=" + dependency);`,
        ``,
      ].join("\n"),
      "packages/dep/tsconfig.json": JSON.stringify({
        files: [],
        references: [{ path: "./tsconfig.lib.json" }],
      }),
      "packages/dep/tsconfig.lib.json": lib,
      "packages/dep/src/value.ts": probe("dependency"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "packages/app/src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "entry=3 dependency=3");
  };
