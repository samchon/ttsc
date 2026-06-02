import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx exposes compiled `.js` counterparts when scanning source root.
 *
 * Locks the root-boundary branch of the runtime fs hook. The existing scanner
 * coverage reads a child directory, but loaders can also scan `__dirname`
 * itself when it is the configured `rootDir`; that directory must receive the
 * same virtual `.js` entries as its descendants.
 *
 * 1. Create a CommonJS project whose entry scans `src` itself for `.js` files.
 * 2. Verify `readdir`, `stat`, `access`, and `readFile` see `RootController.js`.
 * 3. Require the discovered file and assert no real `.js` was written.
 */
export const test_ttsx_exposes_emitted_javascript_counterparts_when_scanning_source_root =
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
        `declare function require(name: string): any;\n` +
        `const fs = require("node:fs") as any;\n` +
        `const path = require("node:path") as any;\n` +
        `const files = fs.readdirSync(__dirname, { withFileTypes: true })\n` +
        `  .filter((entry: { name: string; isFile(): boolean }) => entry.name.endsWith(".js") && entry.isFile())\n` +
        `  .map((entry: { name: string }) => entry.name)\n` +
        `  .sort();\n` +
        `const target = path.join(__dirname, "RootController.js");\n` +
        `fs.accessSync(target);\n` +
        `const readable = fs.readFileSync(target, "utf8").includes("root-controller-ts");\n` +
        `const statFile = fs.statSync(target).isFile();\n` +
        `require(target);\n` +
        `console.log(JSON.stringify({ files, loaded: (globalThis as any).__rootLoaded ?? null, readable, statFile }));\n`,
      "src/RootController.ts": `(globalThis as any).__rootLoaded = "root-controller-ts";\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      files: ["RootController.js"],
      loaded: "root-controller-ts",
      readable: true,
      statFile: true,
    });
    assert.equal(
      fs.existsSync(path.join(root, "src", "RootController.js")),
      false,
    );
  };
