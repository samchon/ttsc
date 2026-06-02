import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx preserves ESM package exports array resolution order.
 *
 * Node does not fall through to a later exports-array target after it selects a
 * valid JavaScript path that is missing on disk. ttsx may only map that
 * selected target to a TypeScript counterpart; it must not re-read the package
 * metadata and execute a later `.ts` fallback that Node never reached.
 *
 * 1. Install an ESM package whose first exports-array target is `missing.js`.
 * 2. Add `fallback.ts` for the later array target.
 * 3. Run ttsx and assert the original missing-target error is preserved.
 */
export const test_ttsx_respects_esm_package_exports_array_resolution_order =
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
      "node_modules/array-order-dep/package.json": JSON.stringify({
        name: "array-order-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": ["./missing.js", "./fallback.js"] },
      }),
      "node_modules/array-order-dep/fallback.ts": `export const value = "should-not-load";\n`,
      "src/main.ts":
        `import { value } from "array-order-dep";\n` + `console.log(value);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing\.js/);
  };
