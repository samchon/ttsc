import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx compiles an installed package's file that the package's own
 * project omits through that project's options, without a type gate.
 *
 * The negative twin of the checked-root case. A file no build covered is
 * compiled alone through its owning `tsconfig.json`, and whether that build is
 * type-checked follows who wrote the file. Code under `node_modules` belongs to
 * someone else: every other file of the package is served from an emit-only
 * build, and a type error that only its own configuration reports must not stop
 * the consumer's program. The legacy decorator's argument count pins that the
 * package's options still applied: `experimentalDecorators` passes three
 * arguments to a method decorator, where standard decorators pass two.
 *
 * 1. Install a package whose tsconfig sets `experimentalDecorators` and `include:
 *    ["src"]`, while its `main` is `index.ts` outside `src`.
 * 2. Give `index.ts` a type error and a legacy method decorator.
 * 3. Run a consumer entry that requires the package.
 * 4. Assert the program runs and observes the legacy decorator's three arguments.
 */
export const test_ttsx_emits_an_installed_package_root_its_own_build_omits_without_a_type_gate =
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
        `declare const require: (id: string) => { decoratorArguments: number };`,
        `console.log("arguments=" + require("legacy-pkg").decoratorArguments);`,
        `export {};`,
        ``,
      ].join("\n"),
      "node_modules/legacy-pkg/package.json": JSON.stringify({
        name: "legacy-pkg",
        version: "1.0.0",
        main: "index.ts",
      }),
      "node_modules/legacy-pkg/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          experimentalDecorators: true,
          types: [],
        },
        include: ["src"],
      }),
      "node_modules/legacy-pkg/src/inside.ts": `export const inside: string = "inside";\n`,
      "node_modules/legacy-pkg/index.ts": [
        `let observed: number = 0;`,
        `function probe(...args: any[]): void {`,
        `  observed = args.length;`,
        `}`,
        `class Box {`,
        `  @probe`,
        `  method(): void {}`,
        `}`,
        `const unchecked: number = "only this package's config would report it";`,
        `export const decoratorArguments: number = observed;`,
        `export const box: Box = new Box();`,
        `export const ignored: number = unchecked;`,
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
