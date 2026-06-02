import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx prefers TypeScript counterparts over co-located JavaScript when
 * a TypeScript source imports a `.js` specifier.
 *
 * TypeScript resolves `import "./value.js"` against `value.ts` during source
 * compilation. Node's default resolver would load a real `value.js` first if it
 * exists beside the source, so the runtime hook must map the specifier back to
 * the TypeScript counterpart before Node accepts the stale JavaScript file.
 *
 * 1. Create a raw ESM dependency with both `value.ts` and `value.js`.
 * 2. Import `./value.js` from the dependency's `index.ts`.
 * 3. Assert `ttsx` runs the compiled TypeScript value, not the stale JS file.
 */
export const test_ttsx_prefers_typescript_counterparts_over_co_located_javascript =
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
      "node_modules/raw-dep/package.json": JSON.stringify({
        name: "raw-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./index.ts" },
      }),
      "node_modules/raw-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "lib",
          rootDir: ".",
        },
        include: ["index.ts", "value.ts"],
      }),
      "node_modules/raw-dep/index.ts":
        `import { value } from "./value.js";\n` +
        `export const message: string = value;\n`,
      "node_modules/raw-dep/value.ts": `export const value: string = "typescript-counterpart";\n`,
      "node_modules/raw-dep/value.js": `export const value = "stale-javascript";\n`,
      "src/main.ts": `import { message } from "raw-dep";\nconsole.log(message);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "typescript-counterpart");
  };
