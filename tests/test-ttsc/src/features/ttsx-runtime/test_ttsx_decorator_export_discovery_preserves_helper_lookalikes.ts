import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorator export discovery ignores helper text inside templates.
 *
 * Both inline and imported helper spellings can occur as data. Scanning them as
 * executable re-exports invents names and rewriting them corrupts the string.
 *
 * 1. Put an export-helper lookalike in a multiline exported template literal.
 * 2. Re-export the owned module through a decorated orphan barrel.
 * 3. Assert the string is unchanged and the lookalike's target contributes no
 *    name.
 */
export const test_ttsx_decorator_export_discovery_preserves_helper_lookalikes =
  () => {
    for (const helper of ["__exportStar", "tslib_1.__exportStar"]) {
      const text = `\n${helper}(require("./ghost"), exports);\n`;
      const root = TestProject.createProject({
        "package.json": '{"type":"module"}',
        "tsconfig.json": TestProject.tsconfig({
          target: "ES2022",
          module: "esnext",
          rootDir: "src",
          outDir: "dist",
        }),
        "src/main.ts": `const name: string = "dep"; const dep = await import(name); console.log(dep.text === ${JSON.stringify(text)}, Object.hasOwn(dep, "ghost"), Object.hasOwn(dep.default, "ghost")); export {};`,
        "node_modules/dep/package.json":
          '{"name":"dep","type":"commonjs","exports":"./index.ts"}',
        "node_modules/dep/index.ts":
          STANDARD_DECORATOR_SOURCE + '\nexport * from "./values/entry";',
        "node_modules/dep/values/tsconfig.json": TestProject.tsconfig(
          { target: "ES2022", module: "commonjs", rootDir: ".", outDir: "lib" },
          { include: ["entry.ts"] },
        ),
        "node_modules/dep/values/entry.ts": `export const text = \`${text}\`;`,
        "node_modules/dep/values/ghost.ts": "export const ghost = 42;",
      });
      const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
        cwd: root,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        result.stdout.trim(),
        STANDARD_DECORATOR_OUTPUT + "\ntrue false false",
      );
    }
  };
