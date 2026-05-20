import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies runner corpus: ESM import.meta.url resolves from configured outDir.
 *
 * ESM modules use `import.meta.url` instead of `__dirname`. ttsx must rewrite
 * that URL to point at the emitted output directory so that patterns like
 * `path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")` resolve to
 * the same location they would in a deployed build.
 *
 * 1. Create an ESM project with `outDir: "bin"` and source under `src/`.
 * 2. Run ttsx against the entry.
 * 3. Assert the file read via the rewritten `import.meta.url` returns the expected
 *    content.
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
