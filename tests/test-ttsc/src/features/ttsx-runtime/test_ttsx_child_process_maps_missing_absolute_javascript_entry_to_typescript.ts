import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies a ttsx child process can execute a missing absolute `.js` entry when
 * a sibling TypeScript source exists.
 *
 * Ttsx installs its runtime hooks through `NODE_OPTIONS` so Node subprocesses
 * inherit them. A child process may still be launched with a compiled-style
 * absolute path such as `${__dirname}/worker.js`; under ttsx source identity,
 * `__dirname` is the source directory and only `worker.ts` exists there. The
 * CommonJS main resolver must map that missing `.js` entry to `worker.ts`
 * without stealing real JavaScript files that do exist.
 *
 * 1. Run a CommonJS ttsx entry that spawns `node <source-dir>/worker.js`.
 * 2. Let the child inherit ttsx's `NODE_OPTIONS` and emit mapping.
 * 3. Assert the child actually executed the TypeScript worker at source identity.
 */
export const test_ttsx_child_process_maps_missing_absolute_javascript_entry_to_typescript =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/main.ts":
        `declare const __dirname: string;\n` +
        `type Env = Record<string, string | undefined>;\n` +
        `declare const process: { env: Env; execPath: string };\n` +
        `declare function require(name: string): any;\n` +
        `const childProcess = require("node:child_process") as {\n` +
        `  spawnSync(command: string, args: string[], options: { encoding: "utf8"; env: Env }): { status: number | null; stderr: string; stdout: string };\n` +
        `};\n` +
        `const path = require("node:path") as { join(...parts: string[]): string };\n` +
        `const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, "worker.js")], {\n` +
        `  encoding: "utf8",\n` +
        `  env: process.env,\n` +
        `});\n` +
        `if (result.status !== 0) throw new Error(result.stderr);\n` +
        `console.log(result.stdout.trim());\n`,
      "src/worker.ts":
        `declare const __filename: string;\n` +
        `console.log("worker-ts:" + __filename.endsWith("worker.ts"));\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "worker-ts:true");
  };
