import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx exposes compiled `.js` counterparts to source-directory scans.
 *
 * Some runtime loaders discover modules by reading `__dirname` and filtering
 * for `.js` files before importing them. Under ttsx source identity only `.ts`
 * files exist in that directory, so the runtime fs hooks must show the `.js`
 * names that the compile gate emitted into the private runtime tree.
 *
 * 1. Create a project whose entry scans `src/controllers` for `.js` files.
 * 2. Use sync/async `readdir` with `withFileTypes`, `existsSync`, and `stat`
 *    before importing a hit.
 * 3. Assert the scanner sees `UserController.js`, imports the TypeScript source,
 *    and does not write a real `.js` beside the source.
 */
export const test_ttsx_exposes_emitted_javascript_counterparts_to_source_directory_scanners =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: ".",
        },
        include: ["src"],
      }),
      "src/main.ts":
        `declare const __dirname: string;\n` +
        `declare const process: { exitCode?: number };\n` +
        `declare function require(name: string): any;\n` +
        `const fs = require("node:fs") as any;\n` +
        `const path = require("node:path") as any;\n` +
        `const dir = path.join(__dirname, "controllers");\n` +
        `const syncFiles = fs.readdirSync(dir, { withFileTypes: true })\n` +
        `  .filter((entry: { name: string; isFile(): boolean }) => entry.name.endsWith(".js") && entry.isFile() && fs.existsSync(path.join(dir, entry.name)))\n` +
        `  .map((entry: { name: string }) => entry.name);\n` +
        `async function main(): Promise<void> {\n` +
        `  const asyncFiles: string[] = [];\n` +
        `  for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {\n` +
        `    const location = path.join(dir, entry.name);\n` +
        `    if (entry.name.endsWith(".js") && entry.isFile() && (await fs.promises.stat(location)).isFile()) asyncFiles.push(entry.name);\n` +
        `  }\n` +
        `  for (const file of asyncFiles) await import(path.join(dir, file));\n` +
        `  console.log(JSON.stringify({ asyncFiles, loaded: (globalThis as any).__loaded ?? null, syncFiles }));\n` +
        `}\n` +
        `main().catch((error) => { console.error(error); process.exitCode = 1; });\n`,
      "src/controllers/UserController.ts": `(globalThis as any).__loaded = "controller-ts";\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      asyncFiles: ["UserController.js"],
      loaded: "controller-ts",
      syncFiles: ["UserController.js"],
    });
    assert.equal(
      fs.existsSync(path.join(root, "src", "controllers", "UserController.js")),
      false,
    );
  };
