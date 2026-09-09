import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies orphan decorator caches never freeze imported const enum values.
 *
 * The cache owns the decorated file's bytes. Inlining an imported value binds
 * that output to another file which can change without invalidating this
 * cache.
 *
 * 1. Run a decorated orphan importing a const enum through a shared cache.
 * 2. Change only the enum source, then change the package from ESM to CommonJS.
 * 3. Assert each new value is observed while the decorated file stays unchanged.
 */
export const test_ttsx_standard_decorators_in_orphans_do_not_cache_imported_values =
  () => {
    const root = TestProject.createProject({
      "package.json": '{"type":"module"}',
      "tsconfig.json": TestProject.tsconfig({
        target: "ES2022",
        module: "esnext",
        rootDir: "src",
        outDir: "dist",
      }),
      "src/main.ts":
        'const name: string = "dep"; const dep = await import(name); console.log(dep.answer); export {};',
      "node_modules/dep/src/index.ts":
        'import { Value } from "./enum";\n' +
        STANDARD_DECORATOR_SOURCE +
        "\nexport const answer = Value.Entry;",
    });
    const cacheDir = TestProject.tmpdir("ttsx-isolated-decorators-");
    for (const [type, answer] of [
      ["module", 1],
      ["module", 2],
      ["commonjs", 3],
      ["commonjs", 4],
    ] as const) {
      TestProject.writeFiles(root, {
        "node_modules/dep/package.json": JSON.stringify({
          name: "dep",
          type,
          exports: "./src/index.ts",
        }),
        "node_modules/dep/src/enum.ts": `export const enum Value { Entry = ${answer} }`,
      });
      const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
        cwd: root,
        env: { TTSC_CACHE_DIR: cacheDir },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        result.stdout.trim(),
        STANDARD_DECORATOR_OUTPUT + "\n" + answer,
      );
    }
  };
