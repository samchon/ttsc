import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorated CommonJS orphans expose const enums through export-star.
 *
 * Isolated runtime emission preserves const enums, so CommonJS name discovery
 * must use the same policy instead of erasing exports that exist at runtime.
 *
 * 1. Export a const enum and an interface directly or through a barrel.
 * 2. Import the decorated CommonJS package into ESM with cold and warm caches.
 * 3. Assert the enum is the actual CommonJS value and the interface stays absent.
 */
export const test_ttsx_standard_decorator_orphans_expose_reexported_const_enums =
  () => {
    const values =
      "export const enum Value { Entry = 42 }\nexport interface OnlyType { value: number }";
    for (const barrel of [false, true]) {
      const root = TestProject.createProject({
        "package.json": '{"type":"module"}',
        "tsconfig.json": TestProject.tsconfig({
          target: "ES2022",
          module: "esnext",
          rootDir: "src",
          outDir: "dist",
        }),
        "src/main.ts":
          'const name: string = "dep"; const dep = await import(name); console.log(dep.Value.Entry, dep.Value === dep.default.Value, Object.hasOwn(dep, "OnlyType")); export {};',
        "node_modules/dep/package.json":
          '{"name":"dep","type":"commonjs","exports":"./index.ts"}',
        "node_modules/dep/index.ts":
          STANDARD_DECORATOR_SOURCE +
          (barrel ? '\nexport * from "./values";' : values),
        "node_modules/dep/values.ts": values,
      });
      const cacheDir = TestProject.tmpdir("ttsx-decorator-reexports-");
      for (let i = 0; i < 2; i++) {
        const result = TestProject.spawn(
          TestProject.TTSX_BIN,
          ["src/main.ts"],
          { cwd: root, env: { TTSC_CACHE_DIR: cacheDir } },
        );
        assert.equal(result.status, 0, result.stderr);
        assert.equal(
          result.stdout.trim(),
          STANDARD_DECORATOR_OUTPUT + "\n42 true false",
        );
      }
    }
  };
