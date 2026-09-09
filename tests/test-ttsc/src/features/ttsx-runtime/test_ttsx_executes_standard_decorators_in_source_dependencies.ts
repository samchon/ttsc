import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorated source dependencies execute with and without a tsconfig.
 *
 * Dependency builds used to preserve ESNext decorators, while orphan ESM
 * stripping could not transform them. Both paths need compiler lowering.
 *
 * 1. Install a decorated raw source package in each module format.
 * 2. Run a dynamic import with and without the dependency's own tsconfig.
 * 3. Assert decoration and the dependency's named export survive cold and warm
 *    runs.
 */
export const test_ttsx_executes_standard_decorators_in_source_dependencies =
  () => {
    const cacheDir = TestProject.tmpdir("ttsx-decorators-cache-");
    for (const module of ["esnext", "commonjs"]) {
      for (const configured of [false, true]) {
        const root = TestProject.createProject({
          "package.json": JSON.stringify({ type: "module" }),
          "tsconfig.json": TestProject.tsconfig({
            target: "ES2022",
            module: "esnext",
            rootDir: "src",
            outDir: "dist",
            strict: true,
          }),
          "src/main.ts": `const name: string = "decorated-dep"; const dep = await import(name); console.log(dep.answer); export {};`,
          "node_modules/decorated-dep/package.json": JSON.stringify({
            name: "decorated-dep",
            type: module === "commonjs" ? "commonjs" : "module",
            exports: "./src/index.ts",
          }),
          ...(configured
            ? {
                "node_modules/decorated-dep/tsconfig.json":
                  TestProject.tsconfig({
                    target: "ESNext",
                    module,
                    rootDir: "src",
                    outDir: "lib",
                  }),
              }
            : {}),
          "node_modules/decorated-dep/src/index.ts":
            'import { answer } from "./helper";\n' +
            STANDARD_DECORATOR_SOURCE +
            "\nexport { answer };\n",
          "node_modules/decorated-dep/src/helper.ts":
            "export const answer = 42;",
        });
        for (let i = 0; i < 2; i++) {
          const result = TestProject.spawn(
            TestProject.TTSX_BIN,
            ["src/main.ts"],
            { cwd: root, env: { TTSC_CACHE_DIR: cacheDir } },
          );
          assert.equal(result.status, 0, result.stderr);
          assert.equal(
            result.stdout.trim(),
            STANDARD_DECORATOR_OUTPUT + "\n42",
          );
        }
      }
    }
  };
