import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx preserves the _runtime values_ a namespace exports when it
 * builds a raw `.ts` source-distribution dependency under that dependency's own
 * tsconfig (the path-2 `runBuild` route).
 *
 * The existing type-strip-cannot-elide test only covers a namespace that holds
 * _types_ (so the whole import elides). This case is the complement: a package
 * ships a `type` + `namespace` merge under one name (`ArrayRepeatedNullable`)
 * where the namespace carries real _runtime_ members (a function and a const),
 * imported as a value and actually called at runtime. A full tsgo build must
 * emit the namespace IIFE (`(function (NS) { ... })(NS || ...)`) so the members
 * exist at link time; if ttsx type-stripped the dependency instead of building
 * it, the namespace value export would vanish and the call would throw `is not
 * a function` / `undefined`.
 *
 * 1. Install an ESM `built-dep` that ships its own `tsconfig.json` and a
 *    `type`+`namespace` merge whose namespace exports runtime members.
 * 2. Run ttsx against an entry that imports the name as a value and calls a
 *    namespace member.
 * 3. Assert the dependency executed and the namespace runtime members produced
 *    their values.
 */
export const test_ttsx_preserves_runtime_namespace_value_export_in_a_built_dependency =
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
      "node_modules/built-dep/package.json": JSON.stringify({
        name: "built-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
      }),
      "node_modules/built-dep/tsconfig.json": JSON.stringify({
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
      // `type` + `namespace` merge under one name: the namespace holds REAL
      // runtime members (a const and a function), which only survive if the
      // dependency is fully built (namespace IIFE emitted), not type-stripped.
      "node_modules/built-dep/src/repeated.ts": [
        `export type ArrayRepeatedNullable<T> = T[] | null;`,
        `export namespace ArrayRepeatedNullable {`,
        `  export const LABEL: string = "repeated";`,
        `  export const of = <T>(...items: T[]): ArrayRepeatedNullable<T> =>`,
        `    items.length === 0 ? null : items;`,
        `}`,
        ``,
      ].join("\n"),
      "node_modules/built-dep/src/index.ts": [
        `import { ArrayRepeatedNullable } from "./repeated";`,
        `export const describe = (): string => {`,
        `  const value = ArrayRepeatedNullable.of(1, 2, 3);`,
        `  const size = value === null ? 0 : value.length;`,
        `  return ArrayRepeatedNullable.LABEL + "-" + size;`,
        `};`,
        ``,
      ].join("\n"),
      "src/main.ts": [
        `import { describe } from "built-dep";`,
        `console.log(describe());`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "repeated-3");
  };
