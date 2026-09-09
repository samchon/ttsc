import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorated barrels retain nested exports across compiler emit
 * options.
 *
 * Owned output may rewrite .ts specifiers or qualify export helpers through
 * tslib. Name discovery must understand that output without changing its
 * values.
 *
 * 1. Re-export an owned barrel with rewriting/importHelpers independently enabled.
 * 2. Exercise both an orphan and a project-owned decorated outer barrel.
 * 3. Assert nested named exports and the original live CommonJS getter survive.
 */
export const test_ttsx_decorated_barrels_keep_nested_exports_with_emit_options =
  () => {
    const tslibRoot = path.dirname(
      createRequire(import.meta.url).resolve("tslib/package.json"),
    );
    for (const owned of [false, true]) {
      for (const rewrite of [false, true]) {
        for (const helpers of [false, true]) {
          const root = TestProject.createProject({
            "package.json": '{"type":"module"}',
            "tsconfig.json": TestProject.tsconfig({
              target: "ES2022",
              module: "esnext",
              rootDir: "src",
              outDir: "dist",
            }),
            "src/main.ts":
              'const name: string = "dep"; const dep = await import(name); console.log(dep.actual, dep.nested, dep.default.nested); dep.change(); console.log(dep.default.nested); export {};',
            "node_modules/dep/package.json":
              '{"name":"dep","type":"commonjs","exports":"./index.ts"}',
            ...(owned
              ? {
                  "node_modules/dep/tsconfig.json": TestProject.tsconfig(
                    {
                      target: "ESNext",
                      module: "commonjs",
                      rootDir: ".",
                      outDir: "lib",
                      importHelpers: helpers,
                      rewriteRelativeImportExtensions: rewrite,
                    },
                    { include: ["index.ts"] },
                  ),
                }
              : {}),
            "node_modules/dep/index.ts":
              STANDARD_DECORATOR_SOURCE + '\nexport * from "./values/entry";',
            "node_modules/dep/values/tsconfig.json": TestProject.tsconfig(
              {
                target: "ES2022",
                module: "commonjs",
                rootDir: ".",
                outDir: "lib",
                importHelpers: helpers,
                rewriteRelativeImportExtensions: rewrite,
              },
              { include: ["*.ts"] },
            ),
            "node_modules/dep/values/entry.ts": `export const actual = 17; export * from "./nested${rewrite ? ".ts" : ""}";`,
            "node_modules/dep/values/nested.ts":
              "export let nested = 42; export function change() { nested = 43; }",
          });
          TestProject.copyDirectory(
            tslibRoot,
            path.join(root, "node_modules/tslib"),
          );
          const result = TestProject.spawn(
            TestProject.TTSX_BIN,
            ["src/main.ts"],
            { cwd: root },
          );
          assert.equal(result.status, 0, result.stderr);
          assert.equal(
            result.stdout.trim(),
            STANDARD_DECORATOR_OUTPUT + "\n17 42 42\n43",
          );
        }
      }
    }
  };
