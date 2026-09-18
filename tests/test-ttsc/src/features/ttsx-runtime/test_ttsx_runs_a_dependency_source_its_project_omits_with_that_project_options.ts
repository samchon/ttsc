import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs a dependency source its own project's file set omits,
 * compiled with that project's options, rather than a same-named file the
 * project did emit.
 *
 * Pins samchon/ttsc#1382 row 6. `dep/tsconfig.json` lists only `a/index.ts`,
 * and the app requires `dep/b/index.ts`. The dependency lane builds `dep` and
 * used to take whatever emitted file scored best on shared trailing segments,
 * so `b/index.ts` ran as `a/index.js`. #1073 had concluded no wrong-file
 * outcome was constructible, which holds only when the requested source was
 * emitted. The file is now compiled alone through `dep`'s options. The legacy
 * decorator pins that it is `dep`'s options and not an isolated emit: under
 * `experimentalDecorators` a method decorator receives three arguments, and
 * under standard decorators two.
 *
 * 1. Create `dep` with `experimentalDecorators` and `files: ["a/index.ts"]`, and
 *    an app whose only file requires `dep/b/index.ts`.
 * 2. Run the app.
 * 3. Assert `b/index.ts` ran, with the legacy decorator's three arguments.
 */
export const test_ttsx_runs_a_dependency_source_its_project_omits_with_that_project_options =
  () => {
    const compilerOptions = {
      target: "ES2022",
      module: "commonjs",
      types: [],
    };
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "workspace", private: true }),
      "app/tsconfig.json": JSON.stringify({
        compilerOptions,
        files: ["main.ts"],
      }),
      "app/main.ts": [
        `declare const require: (path: string) => {`,
        `  identity: string;`,
        `  decoratorArguments: number;`,
        `};`,
        `const b = require("../dep/b/index.ts");`,
        `console.log(b.identity + ":" + b.decoratorArguments);`,
        `export {};`,
        ``,
      ].join("\n"),
      "dep/tsconfig.json": JSON.stringify({
        compilerOptions: { ...compilerOptions, experimentalDecorators: true },
        files: ["a/index.ts"],
      }),
      "dep/a/index.ts": `export const identity: string = "dep-a";\nexport const decoratorArguments: number = -1;\n`,
      "dep/b/index.ts": [
        `let observed: number = 0;`,
        `function probe(...args: any[]): void {`,
        `  observed = args.length;`,
        `}`,
        `class Box {`,
        `  @probe`,
        `  method(): void {}`,
        `}`,
        `export const identity: string = "dep-b";`,
        `export const decoratorArguments: number = observed;`,
        `export const box: Box = new Box();`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "-P", "app/tsconfig.json", "app/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "dep-b:3");
  };
