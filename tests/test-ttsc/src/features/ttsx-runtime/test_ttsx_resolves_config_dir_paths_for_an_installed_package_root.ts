import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx resolves an installed package root's `${configDir}` path
 * mapping from the package's own tsconfig directory.
 *
 * An emit-only root build writes its synthesized tsconfig into ttsx's private
 * directory, which is sound only while nothing it emits depends on where that
 * tsconfig sits. `${configDir}` is the exception: tsgo substitutes the
 * directory of the config it was given, and inside `paths` that decides which
 * module an import resolves to. Here it decides whether `export { Shape }` is a
 * type-only re-export the emit drops, or a runtime import of a specifier Node
 * cannot resolve. A chain that uses `${configDir}` therefore keeps the
 * synthesized tsconfig beside the real one.
 *
 * 1. Install a package whose tsconfig maps `@shapes/*` through `${configDir}`,
 *    with a `main` outside its `include` that re-exports a type through the
 *    mapping.
 * 2. Run a consumer entry that requires the package, so the consumer's own check
 *    never compiles the package's source under the consumer's config.
 * 3. Assert the program ran, which needs the re-export elided.
 */
export const test_ttsx_resolves_config_dir_paths_for_an_installed_package_root =
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
      "node_modules/shape-pkg/package.json": JSON.stringify({
        name: "shape-pkg",
        version: "1.0.0",
        main: "index.ts",
      }),
      "node_modules/shape-pkg/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          types: [],
          paths: { "@shapes/*": ["${configDir}/shapes/*"] },
        },
        include: ["shapes"],
      }),
      "node_modules/shape-pkg/shapes/square.ts": `export interface Shape {\n  readonly side: number;\n}\n`,
      "node_modules/shape-pkg/index.ts": [
        `export { Shape } from "@shapes/square";`,
        `export const area = (side: number): number => side * side;`,
        ``,
      ].join("\n"),
      "src/main.ts": [
        `declare const require: (id: string) => { area(side: number): number };`,
        `console.log("area-" + require("shape-pkg").area(3));`,
        `export {};`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "area-9");
  };
