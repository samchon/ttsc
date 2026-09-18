import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx compiles a required source through its owning project's options
 * when that project's own build produces nothing.
 *
 * A config that lists no files emits nothing, so the runtime's build of the
 * owning project has no output to serve. That says nothing about the file the
 * program reached, which is a root the build did not compile like any other,
 * and it must still get the project's options and type gate. Falling back to
 * the isolated emit instead would drop both. The legacy decorator's argument
 * count identifies the project's options: `experimentalDecorators` passes three
 * arguments to a method decorator, where standard decorators pass two.
 *
 * 1. Create `tools/tsconfig.json` with `experimentalDecorators` and `files: []`,
 *    and a `tools/probe.ts` beside it that records a method decorator's
 *    argument count.
 * 2. Run an entry that requires `tools/probe.ts` by path.
 * 3. Assert the program observes the legacy decorator's three arguments.
 */
export const test_ttsx_compiles_a_required_source_whose_project_lists_no_files =
  () => {
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
      "src/main.ts": [
        `declare const require: (path: string) => { decoratorArguments: number };`,
        `const { decoratorArguments } = require("../tools/probe.ts");`,
        `console.log("arguments=" + decoratorArguments);`,
        `export {};`,
        ``,
      ].join("\n"),
      "tools/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          experimentalDecorators: true,
          types: [],
        },
        files: [],
      }),
      "tools/probe.ts": [
        `let observed: number = 0;`,
        `function probe(...args: any[]): void {`,
        `  observed = args.length;`,
        `}`,
        `class Box {`,
        `  @probe`,
        `  method(): void {}`,
        `}`,
        `new Box();`,
        `export const decoratorArguments: number = observed;`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "arguments=3");
  };
