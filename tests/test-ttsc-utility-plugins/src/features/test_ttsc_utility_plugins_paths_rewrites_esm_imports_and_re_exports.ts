import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProject, spawn, ttscBin } from "@ttsc/testing";
import { TestTtscUtilityPlugins } from "../internal/ttsc-utility-plugins";

/**
 * Verifies utility plugins: paths rewrites ESM imports and re-exports.
 *
 * This utility plugin scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_utility_plugins_paths_rewrites_esm_imports_and_re_exports =
  () => {
    const root = createProject({
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
    TestTtscUtilityPlugins.seedUtilityPackages(root, ["paths"]);
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: TestTtscUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-utility-paths-"),
        ),
      },
    });
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
