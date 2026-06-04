import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx preserves an `enum`'s *runtime object* when it builds a raw
 * `.ts` source-distribution dependency under that dependency's own tsconfig (the
 * path-2 `runBuild` route).
 *
 * The existing enum coverage exercises the published-ESM-under-node_modules
 * transpile path (`load`-hook `transform` mode). This case is the general build
 * path: a package that ships its own `tsconfig.json` and re-exports an `enum`
 * used both as a *type* and as a runtime value (reverse mapping + member access).
 * A full tsgo build must emit the enum IIFE so both directions work at runtime;
 * if ttsx merely type-stripped the dependency, the enum object would be gone and
 * the member access / reverse mapping would be `undefined`.
 *
 * 1. Install an ESM `enum-dep` that ships its own `tsconfig.json` and re-exports
 *    a numeric `enum`.
 * 2. Run ttsx against an entry that reads an enum member and its reverse mapping.
 * 3. Assert the dependency executed and produced the enum runtime values.
 */
export const test_ttsx_preserves_enum_runtime_object_in_a_built_dependency =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/enum-dep/package.json": JSON.stringify({
        name: "enum-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
      }),
      "node_modules/enum-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      // A numeric enum used as a runtime object: both forward member access and
      // reverse (number -> name) mapping only exist if the enum IIFE is emitted.
      "node_modules/enum-dep/src/level.ts": [
        `export enum Level {`,
        `  Low = 1,`,
        `  High = 2,`,
        `}`,
        ``,
      ].join("\n"),
      "node_modules/enum-dep/src/index.ts": [
        `import { Level } from "./level";`,
        `export const report = (): string => {`,
        `  const forward: number = Level.High;`,
        `  const reverse: string = Level[Level.Low];`,
        `  return reverse + "-" + forward;`,
        `};`,
        ``,
      ].join("\n"),
      "src/main.ts": [
        `import { report } from "enum-dep";`,
        `console.log(report());`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "Low-2");
  };
