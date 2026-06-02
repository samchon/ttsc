import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx maps CommonJS package JavaScript entry targets back to raw
 * TypeScript when the JavaScript files have not been published.
 *
 * Classic `require()` bypasses the ESM `resolve`/`load` hooks and reports the
 * resolved missing JavaScript target from package `main`/`exports`. The
 * CommonJS resolver patch must recover that target and route it to the matching
 * `.ts` source, while preserving normal missing-package errors.
 *
 * 1. Install CommonJS packages whose entry metadata points to missing `.js` files:
 *    `main`, `exports`, default `index.js`, subpath export, and wildcard
 *    subpath export, and conditional `require`.
 * 2. Run ttsx against a CommonJS entry requiring every package.
 * 3. Assert all raw TypeScript entry files executed.
 */
export const test_ttsx_resolves_commonjs_package_javascript_entry_targets_to_raw_typescript_source =
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
      "node_modules/js-main-dep/package.json": JSON.stringify({
        name: "js-main-dep",
        version: "1.0.0",
        main: "./index.js",
      }),
      "node_modules/js-main-dep/index.ts":
        `const state = globalThis as Record<string, unknown>;\n` +
        `state.__jsMainDep = "main-js-target-ok";\n`,
      "node_modules/js-exports-cjs-dep/package.json": JSON.stringify({
        name: "js-exports-cjs-dep",
        version: "1.0.0",
        exports: { ".": "./index.js" },
      }),
      "node_modules/js-exports-cjs-dep/index.ts":
        `const state = globalThis as Record<string, unknown>;\n` +
        `state.__jsExportsCjsDep = "exports-js-target-ok";\n`,
      "node_modules/js-default-dep/package.json": JSON.stringify({
        name: "js-default-dep",
        version: "1.0.0",
      }),
      "node_modules/js-default-dep/index.ts":
        `const state = globalThis as Record<string, unknown>;\n` +
        `state.__jsDefaultDep = "default-js-target-ok";\n`,
      "node_modules/js-subpath-dep/package.json": JSON.stringify({
        name: "js-subpath-dep",
        version: "1.0.0",
        exports: { "./tool": "./tool.js" },
      }),
      "node_modules/js-subpath-dep/tool.ts":
        `const state = globalThis as Record<string, unknown>;\n` +
        `state.__jsSubpathDep = "subpath-js-target-ok";\n`,
      "node_modules/js-pattern-dep/package.json": JSON.stringify({
        name: "js-pattern-dep",
        version: "1.0.0",
        exports: { "./features/*": "./src/features/*.js" },
      }),
      "node_modules/js-pattern-dep/src/features/tool.ts":
        `const state = globalThis as Record<string, unknown>;\n` +
        `state.__jsPatternDep = "pattern-js-target-ok";\n`,
      "node_modules/js-conditional-dep/package.json": JSON.stringify({
        name: "js-conditional-dep",
        version: "1.0.0",
        exports: { ".": { import: "./esm.js", require: "./cjs.js" } },
      }),
      "node_modules/js-conditional-dep/esm.ts":
        `const esmState = globalThis as Record<string, unknown>;\n` +
        `esmState.__jsConditionalDep = "wrong-branch";\n`,
      "node_modules/js-conditional-dep/cjs.ts":
        `const cjsState = globalThis as Record<string, unknown>;\n` +
        `cjsState.__jsConditionalDep = "conditional-require-js-target-ok";\n`,
      "src/main.ts":
        `declare function require(name: string): unknown;\n` +
        `require("js-main-dep");\n` +
        `require("js-exports-cjs-dep");\n` +
        `require("js-default-dep");\n` +
        `require("js-subpath-dep/tool");\n` +
        `require("js-pattern-dep/features/tool");\n` +
        `require("js-conditional-dep");\n` +
        `const state = globalThis as Record<string, unknown>;\n` +
        `console.log([\n` +
        `  state.__jsMainDep,\n` +
        `  state.__jsExportsCjsDep,\n` +
        `  state.__jsDefaultDep,\n` +
        `  state.__jsSubpathDep,\n` +
        `  state.__jsPatternDep,\n` +
        `  state.__jsConditionalDep,\n` +
        `].join(":"));\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim(),
      [
        "main-js-target-ok",
        "exports-js-target-ok",
        "default-js-target-ok",
        "subpath-js-target-ok",
        "pattern-js-target-ok",
        "conditional-require-js-target-ok",
      ].join(":"),
    );
  };
