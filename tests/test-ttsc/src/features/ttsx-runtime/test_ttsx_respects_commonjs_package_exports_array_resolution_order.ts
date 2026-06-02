import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx preserves CommonJS package exports array resolution order.
 *
 * Classic `require()` reports the JavaScript file selected by Node's package
 * exports array before module loading begins. When that selected file has no
 * TypeScript counterpart, ttsx must keep the error instead of resolving a later
 * exports-array target on its own.
 *
 * 1. Install a CommonJS package whose first exports-array target is `missing.js`.
 * 2. Add `fallback.ts` for the later array target.
 * 3. Run ttsx and assert the original missing-target error is preserved.
 */
export const test_ttsx_respects_commonjs_package_exports_array_resolution_order =
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
      "node_modules/array-order-cjs-dep/package.json": JSON.stringify({
        name: "array-order-cjs-dep",
        version: "1.0.0",
        exports: { ".": ["./missing.js", "./fallback.js"] },
      }),
      "node_modules/array-order-cjs-dep/fallback.ts":
        `const state = globalThis as Record<string, unknown>;\n` +
        `state.__arrayOrderCjsDep = "should-not-load";\n`,
      "src/main.ts":
        `declare function require(name: string): unknown;\n` +
        `require("array-order-cjs-dep");\n` +
        `const state = globalThis as Record<string, unknown>;\n` +
        `console.log(state.__arrayOrderCjsDep);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing\.js/);
  };
