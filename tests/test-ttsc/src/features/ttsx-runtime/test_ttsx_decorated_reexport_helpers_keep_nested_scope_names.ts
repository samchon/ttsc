import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorated modules retain helper re-export names in nested scopes.
 *
 * Node's lexer only lists top-level re-export helpers. The runtime previously
 * recognized block/function helper calls too, and normalizing metadata must
 * preserve those names while leaving conditional execution unchanged.
 *
 * 1. Put a tslib star helper at top level, in a block, an IIFE, or a static block.
 * 2. Exercise both a decorated orphan and an owned middle module.
 * 3. Assert ESM and CommonJS retain the same real re-export value.
 */
export const test_ttsx_decorated_reexport_helpers_keep_nested_scope_names =
  () => {
    const tslibRoot = path.dirname(
      createRequire(import.meta.url).resolve("tslib/package.json"),
    );
    for (const shape of ["top", "block", "iife", "class"]) {
      for (const middle of [false, true]) {
        const statement = `tslib.__exportStar(require("${middle ? "./nested" : "./values/entry"}"), exports);`;
        const wrapped =
          shape === "block"
            ? `if (true) {\n${statement}\n}`
            : shape === "iife"
              ? `(function () {\n${statement}\n})();`
              : shape === "class"
                ? `class ExportScope { static {\n${statement}\n} }`
                : statement;
        const helper =
          'import * as tslib from "tslib";\ndeclare function require(name: string): unknown;\ndeclare const exports: any;\n' +
          wrapped;
        const root = TestProject.createProject({
          "package.json": '{"type":"module"}',
          "tsconfig.json": TestProject.tsconfig({
            target: "ES2022",
            module: "esnext",
            rootDir: "src",
            outDir: "dist",
          }),
          "src/main.ts":
            'const name: string = "dep"; const dep = await import(name); console.log(dep.actual, dep.default.actual); export {};',
          "node_modules/dep/package.json":
            '{"name":"dep","type":"commonjs","exports":"./index.ts"}',
          "node_modules/dep/index.ts":
            STANDARD_DECORATOR_SOURCE +
            (middle ? '\nexport * from "./values/entry";' : helper),
          "node_modules/dep/values/tsconfig.json": TestProject.tsconfig(
            {
              target: "ES2022",
              module: "commonjs",
              rootDir: ".",
              outDir: "lib",
            },
            { include: ["*.ts"] },
          ),
          "node_modules/dep/values/entry.ts": middle
            ? helper
            : 'export * from "./nested";',
          "node_modules/dep/values/nested.ts": "export const actual = 17;",
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
          STANDARD_DECORATOR_OUTPUT + "\n17 17",
          `${shape}/${middle}`,
        );
      }
    }
  };
