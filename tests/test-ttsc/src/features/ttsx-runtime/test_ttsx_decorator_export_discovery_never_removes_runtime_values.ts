import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorator export-name hints never remove real CommonJS values.
 *
 * Static discovery can be incomplete for computed JavaScript exports. It may
 * advertise known names to Node, but it cannot replace the runtime star helper
 * with a smaller list and delete values the helper would have exported.
 *
 * 1. Re-export a known name and a computed CommonJS property from an owned barrel.
 * 2. Load that barrel through a decorated orphan and an ESM consumer.
 * 3. Assert the known named export and the computed default-object value survive.
 */
export const test_ttsx_decorator_export_discovery_never_removes_runtime_values =
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
        'const name: string = "dep"; const dep = await import(name); console.log(dep.actual, dep.default.dynamic); export {};',
      "node_modules/dep/package.json":
        '{"name":"dep","type":"commonjs","exports":"./index.ts"}',
      "node_modules/dep/index.ts":
        STANDARD_DECORATOR_SOURCE + '\nexport * from "./values/entry";',
      "node_modules/dep/values/tsconfig.json": TestProject.tsconfig(
        { target: "ES2022", module: "commonjs", rootDir: ".", outDir: "lib" },
        { include: ["entry.ts"] },
      ),
      "node_modules/dep/values/entry.ts":
        'export const actual = 17; export * from "./dynamic.cjs";',
      "node_modules/dep/values/dynamic.cjs":
        'module.exports["dyn" + "amic"] = 42;',
    });
    const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
      cwd: root,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT + "\n17 42");
  };
