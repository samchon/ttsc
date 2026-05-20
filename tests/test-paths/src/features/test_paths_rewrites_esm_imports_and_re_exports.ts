import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestPaths } from "../internal/TestPaths";

/**
 * Verifies the @ttsc/paths plugin: paths rewrites ESM imports and re-exports.
 *
 * The paths plugin must rewrite every reference to a `compilerOptions.paths`
 * alias — static imports, named re-exports, type-only re-exports, inline
 * `import()` types, dynamic `import()` expressions, and CommonJS-style
 * `require()` calls — in both `.js` and `.d.ts` outputs. A single missed form
 * would leave broken specifiers that bundlers or runtimes cannot resolve. It
 * also covers the multi-candidate alias (`@lib/*` maps to two directories)
 * where the first candidate is a missing path and the second resolves.
 *
 * 1. Create an ES2022 module project with `paths` aliases covering an exact match,
 *    a wildcard with a missing first candidate, and a bare specifier, and
 *    source files using all six import/export forms.
 * 2. Run `ttsc --emit` against that project.
 * 3. Assert all alias specifiers are replaced with relative paths in `.js` and
 *    `.d.ts`, including the `declare module` augmentation block.
 */
export const test_paths_rewrites_esm_imports_and_re_exports = () => {
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ES2022",
        declaration: true,
        strict: true,
        paths: {
          "@pkg": ["./src/pkg"],
          "@lib/exact": ["./src/modules/exact.ts"],
          "@lib/*": ["./src/missing/*", "./src/modules/*"],
        },
        outDir: "dist",
        rootDir: "src",
        plugins: [{ transform: "@ttsc/paths" }],
      },
      include: ["src"],
    }),
    "src/modules/exact.ts": `export const exact = "exact" as const;\n`,
    "src/modules/message.ts": `export interface MessageBox { value: string }\nexport const message = "paths";\n`,
    "src/pkg/index.ts": `export const index = "index" as const;\n`,
    "src/main.ts": [
      `declare const require: (id: string) => unknown;`,
      `import { message } from "@lib/message";`,
      `import { exact } from "@lib/exact";`,
      `import { index } from "@pkg";`,
      `export { message } from "@lib/message";`,
      `export type { MessageBox } from "@lib/message";`,
      `export type ImportedBox = import("@lib/message").MessageBox;`,
      `export const loaded = require("@lib/message");`,
      `export const value = message + ":" + exact + ":" + index;`,
      `export async function loadMessage(): Promise<string> {`,
      `  return (await import("@lib/message")).message;`,
      `}`,
      `declare module "@lib/message" {`,
      `  export const augmented: string;`,
      `}`,
      ``,
    ].join("\n"),
  });
  TestPaths.seedPackage(root);
  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    {
      cwd: root,
      env: {
        PATH: TestPaths.goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-paths-"),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /from "\.\/modules\/exact\.js"/);
  assert.match(js, /from "\.\/modules\/message\.js"/);
  assert.match(js, /from "\.\/pkg\/index\.js"/);
  assert.match(js, /require\("\.\/modules\/message\.js"\)/);
  assert.match(js, /import\("\.\/modules\/message\.js"\)/);
  assert.doesNotMatch(js, /@lib\/message/);
  assert.doesNotMatch(js, /@lib\/exact/);
  assert.doesNotMatch(js, /@pkg/);
  const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
  assert.match(dts, /from "\.\/modules\/message\.js"/);
  assert.match(dts, /import\("\.\/modules\/message\.js"\)/);
  assert.match(dts, /declare module "\.\/modules\/message\.js"/);
  assert.doesNotMatch(dts, /@lib\/message/);
};
