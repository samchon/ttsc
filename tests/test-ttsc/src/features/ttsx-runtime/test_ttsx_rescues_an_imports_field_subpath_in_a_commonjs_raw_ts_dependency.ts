import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx rescues a Node `imports` (`#`) subpath to its `.ts` source in a
 * CommonJS raw dependency.
 *
 * Classic `require()` reports an `imports`-map failure without a resolved URL
 * (unlike the ESM loader), so the `#` subpath must be re-derived from the
 * importer's own package `imports` map. A loader that only handled relative,
 * absolute, and bare package specifiers would misroute `#internal` to
 * node_modules resolution and fail.
 *
 * 1. Install a CommonJS raw dependency whose `index.ts` imports `#internal`, with
 *    the `imports` map pointing at an unbuilt `.js` and only `internal.ts`.
 * 2. Require the dependency from a CommonJS entry.
 * 3. Assert the internal `.ts` source ran.
 */
export const test_ttsx_rescues_an_imports_field_subpath_in_a_commonjs_raw_ts_dependency =
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
      "node_modules/imports-cjs-dep/package.json": JSON.stringify({
        name: "imports-cjs-dep",
        version: "1.0.0",
        main: "./index.js",
        imports: { "#internal": "./internal.js" },
      }),
      "node_modules/imports-cjs-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          rootDir: ".",
        },
        include: ["index.ts", "internal.ts"],
      }),
      "node_modules/imports-cjs-dep/internal.ts":
        `const state = globalThis as Record<string, unknown>;\n` +
        `state.__importsCjs = "imports-field-cjs-ok";\n`,
      "node_modules/imports-cjs-dep/index.ts": `import "#internal";\n`,
      "src/main.ts":
        `declare function require(name: string): unknown;\n` +
        `require("imports-cjs-dep");\n` +
        `const state = globalThis as Record<string, unknown>;\n` +
        `console.log(state.__importsCjs);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "imports-field-cjs-ok");
  };
