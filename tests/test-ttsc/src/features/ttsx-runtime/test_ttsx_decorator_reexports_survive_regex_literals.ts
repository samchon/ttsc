import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies regex literals cannot hide decorated modules' real re-exports.
 *
 * A backtick in a regex is data, not a template opener. The same lexical rule
 * applies to the decorated orphan and to each project-owned recursive barrel.
 *
 * 1. Put a backtick regex, division, or no extra syntax before a re-export.
 * 2. Exercise both outer and middle barrel positions.
 * 3. Assert ESM names and the original CommonJS values both remain available.
 */
export const test_ttsx_decorator_reexports_survive_regex_literals = () => {
  for (const snippet of [
    "",
    "const marker = /`/;",
    "const ratio = 8 / 2 / 2;",
  ]) {
    for (const middle of [false, true]) {
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
          (middle ? "" : snippet) +
          '\nexport * from "./values/entry";',
        "node_modules/dep/values/tsconfig.json": TestProject.tsconfig(
          { target: "ES2022", module: "commonjs", rootDir: ".", outDir: "lib" },
          { include: ["*.ts"] },
        ),
        "node_modules/dep/values/entry.ts":
          (middle ? snippet : "") + '\nexport * from "./nested";',
        "node_modules/dep/values/nested.ts": "export const actual = 17;",
      });
      const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
        cwd: root,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT + "\n17 17");
    }
  }
};
