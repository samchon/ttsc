import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx loads an ESM raw-`.ts` dependency that uses `createRequire`.
 *
 * A real ESM dependency may use `createRequire(import.meta.url)` to load a JSON
 * asset while still exporting named ESM bindings. The compiled JavaScript then
 * contains both `import`/`export` and a `require(...)` call; the runtime format
 * detector must honor the package's `type: "module"` instead of mislabeling the
 * file CommonJS because it saw the `require` token.
 *
 * 1. Install a `type: "module"` raw-`.ts` dependency that uses `createRequire`.
 * 2. Import its named export from an ESM entry.
 * 3. Assert the dependency ran as ESM and loaded its JSON asset.
 */
export const test_ttsx_loads_an_esm_raw_ts_dependency_that_uses_create_require =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/types.d.ts": `declare module "node:module" {\n  export function createRequire(url: string): (id: string) => any;\n}\n`,
      "src/main.ts": `import { readAsset } from "req-dep";\nconsole.log(readAsset());\n`,
      "node_modules/req-dep/package.json": JSON.stringify({
        name: "req-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./index.ts" },
      }),
      "node_modules/req-dep/node.d.ts": `declare module "node:module" {\n  export function createRequire(url: string): (id: string) => any;\n}\n`,
      "node_modules/req-dep/data.json": JSON.stringify({
        value: "create-require-ok",
      }),
      "node_modules/req-dep/index.ts": `import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);\nexport const readAsset = (): string => require("./data.json").value;\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "create-require-ok");
  };
