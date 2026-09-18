import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx still compiles an installed package's root through the
 * package's own options when that config sets `noEmitOnError` and the root has
 * a type error.
 *
 * An emit-only build fails only when it wrote no JavaScript, so a diagnostic
 * must never withhold the emit. The root inherits every option of its owning
 * project, and an inherited `noEmitOnError: true` would turn the package's own
 * type error into an empty output. The runtime would then fall back to
 * compiling the file with no project at all, and the package's options would
 * silently stop applying. The legacy decorator's argument count pins that they
 * still apply: `experimentalDecorators` passes three arguments to a method
 * decorator, where standard decorators pass two.
 *
 * 1. Install a package with `noEmitOnError: true` and `experimentalDecorators`
 *    whose `main` is a root outside its `include`, carrying a type error and a
 *    legacy method decorator.
 * 2. Run a consumer entry that requires the package.
 * 3. Assert the program observes the legacy decorator's three arguments.
 */
export const test_ttsx_emits_an_installed_package_root_whose_config_sets_no_emit_on_error =
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
        `console.log("arguments=" + require("strict-pkg").decoratorArguments);`,
        `export {};`,
        ``,
      ].join("\n"),
      "node_modules/strict-pkg/package.json": JSON.stringify({
        name: "strict-pkg",
        version: "1.0.0",
        main: "index.ts",
      }),
      "node_modules/strict-pkg/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          noEmitOnError: true,
          experimentalDecorators: true,
          types: [],
        },
        include: ["src"],
      }),
      "node_modules/strict-pkg/src/inside.ts": `export const inside: string = "inside";\n`,
      "node_modules/strict-pkg/index.ts": [
        `let observed: number = 0;`,
        `function probe(...args: any[]): void {`,
        `  observed = args.length;`,
        `}`,
        `class Box {`,
        `  @probe`,
        `  method(): void {}`,
        `}`,
        `const unchecked: number = "only this package's config reports it";`,
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
