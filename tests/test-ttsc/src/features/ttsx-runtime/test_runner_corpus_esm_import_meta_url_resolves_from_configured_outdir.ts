import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies runner corpus: ESM import.meta.url resolves from configured outDir.
 *
 * This ttsx runner corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_runner_corpus_esm_import_meta_url_resolves_from_configured_outdir =
  () => {
    const root = TestProject.createProject({
      "app/package.json": JSON.stringify({ type: "module" }),
      "app/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "bin",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "app/src/node.d.ts": `
      declare module "node:fs" {
        export function readFileSync(file: string, encoding: string): string;
      }
      declare module "node:path" {
        export function dirname(file: string): string;
        export function resolve(...parts: string[]): string;
      }
      declare module "node:url" {
        export function fileURLToPath(url: string): string;
      }
    `,
      "app/src/global.ts": `
      import path from "node:path";
      import { fileURLToPath } from "node:url";

      export const ROOT = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
      );
    `,
      "app/src/main.ts": `
      import fs from "node:fs";
      import { ROOT } from "./global";

      console.log(fs.readFileSync(ROOT + "/../template/data.txt", "utf8"));
    `,
      "template/data.txt": "import-meta-preserved",
    });
    const cwd = path.join(root, "app");

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", cwd, "src/main.ts"],
      { cwd },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "import-meta-preserved");
  };
