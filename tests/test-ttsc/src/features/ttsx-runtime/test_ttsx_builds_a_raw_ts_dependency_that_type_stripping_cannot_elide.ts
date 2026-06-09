import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx builds a raw `.ts` dependency under its own tsconfig instead of
 * type-stripping it, so type-only elision a stripper cannot do still works.
 *
 * A package that ships source can merge a `type` and a `namespace` under one
 * name (`Brand`) where the namespace holds only types, then import that name as
 * a value-shaped binding used solely in type positions. A full tsgo build
 * resolves the type and elides the import entirely; Node's isolated
 * type-stripping cannot, so the ESM named import would dangle (`does not
 * provide an export named 'Brand'`) at link time. ttsx must therefore find the
 * dependency's own `tsconfig.json` and build it.
 *
 * 1. Install an ESM `built-dep` that ships its own `tsconfig.json` and a
 *    `type`+`namespace` merge imported for its type only.
 * 2. Run ttsx against an entry that calls the dependency.
 * 3. Assert the dependency executed (it would fail to link if type-stripped).
 */
export const test_ttsx_builds_a_raw_ts_dependency_that_type_stripping_cannot_elide =
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
      "node_modules/built-dep/src/brand.ts": [
        `export type Brand<T> = T & { readonly __brand: unique symbol };`,
        `export namespace Brand {`,
        `  export interface Options {`,
        `    readonly tag: string;`,
        `  }`,
        `}`,
        ``,
      ].join("\n"),
      "node_modules/built-dep/src/index.ts": [
        `import { Brand } from "./brand";`,
        `export const wrap = (value: number): Brand<number> =>`,
        `  value as Brand<number>;`,
        ``,
      ].join("\n"),
      "src/main.ts": [
        `import { wrap } from "built-dep";`,
        `console.log("wrapped-" + wrap(7));`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "wrapped-7");
  };
