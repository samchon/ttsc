import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

const RUNTIME_SHIM =
  `declare module "node:fs" {\n` +
  `  const fs: { readFileSync(p: URL, encoding: string): string };\n` +
  `  export default fs;\n` +
  `}\n`;

/**
 * Verifies a raw-`.ts` dependency can read a co-located asset through
 * `import.meta.url` (an `fs` read, NOT an `import`).
 *
 * `ttsx` keeps each `.ts` at its own source path and serves the compiled
 * JavaScript as that source's bytes, so `import.meta.url` resolves to the
 * dependency's real source directory — where the asset actually sits. A design
 * that relocated the module's identity to a compiled-output directory would
 * read from there, where the asset was never copied, and fail with `ENOENT`.
 *
 * 1. Install an `asset-dep` whose `.ts` reads a sibling `data.txt` via
 *    `fs.readFileSync(new URL("./data.txt", import.meta.url))`.
 * 2. Run `ttsx` against an entry importing it.
 * 3. Assert the dependency read the asset and printed its content.
 */
export const test_ttsx_serves_a_dependency_asset_read_through_import_meta_url =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ESNext",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/asset-dep/package.json": JSON.stringify({
        name: "asset-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
      }),
      "node_modules/asset-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      // Ambient shim so both the entry gate and the dependency build type-check
      // the `node:fs`/`URL`/`import.meta` usage without `@types/node`. It lives
      // in both source trees because each is compiled as its own program.
      "src/runtime.d.ts": RUNTIME_SHIM,
      "node_modules/asset-dep/src/runtime.d.ts": RUNTIME_SHIM,
      "node_modules/asset-dep/src/index.ts":
        `import fs from "node:fs";\n` +
        `export const read = (): string =>\n` +
        `  fs.readFileSync(new URL("./data.txt", import.meta.url), "utf8").trim();\n`,
      "node_modules/asset-dep/src/data.txt": "asset-via-import-meta\n",
      "src/main.ts": `import { read } from "asset-dep";\nconsole.log(read());\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "asset-via-import-meta");
  };
