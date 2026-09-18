import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx gives a file the program writes at run time the options of the
 * referenced project that contains it, after another file of that project was
 * already served.
 *
 * Under a solution-style config, the owning project is the referenced one whose
 * root files contain the file, and the runtime asks the compiler for those root
 * files once per config rather than once per file. A file the program writes
 * after that answer was taken is missing from it. Taken at face value, the file
 * falls back to the solution's own empty options, the failure samchon/ttsc#1406
 * fixed for files that existed from the start. The legacy decorator's argument
 * count identifies the project that enables `experimentalDecorators`: three
 * arguments, where standard decorators pass two.
 *
 * 1. Create a root solution referencing `tsconfig.app.json` (legacy decorators,
 *    `src`) and `tsconfig.node.json` (`tools`).
 * 2. Run `tools/run.ts`, which requires `src/existing.ts`, then writes
 *    `src/generated.ts` and requires it.
 * 3. Assert both files ran with legacy decorators.
 */
export const test_ttsx_runs_a_generated_file_with_the_referenced_project_that_owns_it =
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
    const options = {
      target: "ES2022",
      module: "commonjs",
      strict: true,
      types: [],
    };
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "solution", private: true }),
      "tsconfig.json": JSON.stringify({
        files: [],
        references: [
          { path: "./tsconfig.app.json" },
          { path: "./tsconfig.node.json" },
        ],
      }),
      "tsconfig.app.json": JSON.stringify({
        compilerOptions: { ...options, experimentalDecorators: true },
        include: ["src"],
      }),
      "tsconfig.node.json": JSON.stringify({
        compilerOptions: options,
        include: ["tools"],
      }),
      "src/existing.ts": probe("existing"),
      "tools/run.ts": [
        `declare const require: (id: string) => any;`,
        `declare const __dirname: string;`,
        `const fs = require("node:fs");`,
        `const path = require("node:path");`,
        `const { existing } = require("../src/existing.ts");`,
        `fs.writeFileSync(`,
        `  path.join(__dirname, "..", "src", "generated.ts"),`,
        `  ${JSON.stringify(probe("generated"))},`,
        `);`,
        `const { generated } = require("../src/generated.ts");`,
        `console.log("existing=" + existing + " generated=" + generated);`,
        `export {};`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "tools/run.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "existing=3 generated=3");
  };
