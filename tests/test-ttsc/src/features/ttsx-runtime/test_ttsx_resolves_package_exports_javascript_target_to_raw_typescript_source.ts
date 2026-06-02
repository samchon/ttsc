import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx maps package JavaScript entry targets back to raw TypeScript
 * when the JavaScript files have not been published.
 *
 * Some raw-TS packages keep publish-time entry targets at `.js` paths even
 * though the local package currently only has `.ts` sources. Node resolves the
 * bare/subpath package specifier through package `exports`, `main`, default
 * `index.js`, or conditional branches first and then reports a missing
 * JavaScript file. ttsx must rescue that final target, not just the original
 * bare specifier, and serve the matching source `.ts`.
 *
 * 1. Install ESM packages whose entry metadata points to missing `.js` files.
 * 2. Run ttsx against an ESM entry importing all package entry shapes.
 * 3. Assert every matching `.ts` source was compiled and executed.
 */
export const test_ttsx_resolves_package_exports_javascript_target_to_raw_typescript_source =
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
      "node_modules/js-export-dep/package.json": JSON.stringify({
        name: "js-export-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./index.js" },
      }),
      "node_modules/js-export-dep/index.ts": `export const value = (): string => "exports-js-target-ok";\n`,
      "node_modules/js-main-dep/package.json": JSON.stringify({
        name: "js-main-dep",
        version: "1.0.0",
        type: "module",
        main: "./index.js",
      }),
      "node_modules/js-main-dep/index.ts": `export const value = (): string => "main-js-target-ok";\n`,
      "node_modules/js-default-dep/package.json": JSON.stringify({
        name: "js-default-dep",
        version: "1.0.0",
        type: "module",
      }),
      "node_modules/js-default-dep/index.ts": `export const value = (): string => "default-js-target-ok";\n`,
      "node_modules/js-subpath-dep/package.json": JSON.stringify({
        name: "js-subpath-dep",
        version: "1.0.0",
        type: "module",
        exports: { "./tool": "./tool.js" },
      }),
      "node_modules/js-subpath-dep/tool.ts": `export const value = (): string => "subpath-js-target-ok";\n`,
      "node_modules/js-pattern-dep/package.json": JSON.stringify({
        name: "js-pattern-dep",
        version: "1.0.0",
        type: "module",
        exports: { "./features/*": "./src/features/*.js" },
      }),
      "node_modules/js-pattern-dep/src/features/tool.ts": `export const value = (): string => "pattern-js-target-ok";\n`,
      "node_modules/js-conditional-dep/package.json": JSON.stringify({
        name: "js-conditional-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": { import: "./esm.js", require: "./cjs.js" } },
      }),
      "node_modules/js-conditional-dep/esm.ts": `export const value = (): string => "conditional-import-js-target-ok";\n`,
      "node_modules/js-conditional-dep/cjs.ts": `export const value = (): string => "wrong-branch";\n`,
      "src/main.ts":
        `import { value as fromExports } from "js-export-dep";\n` +
        `import { value as fromMain } from "js-main-dep";\n` +
        `import { value as fromDefault } from "js-default-dep";\n` +
        `import { value as fromSubpath } from "js-subpath-dep/tool";\n` +
        `import { value as fromPattern } from "js-pattern-dep/features/tool";\n` +
        `import { value as fromConditional } from "js-conditional-dep";\n` +
        `console.log([\n` +
        `  fromExports(),\n` +
        `  fromMain(),\n` +
        `  fromDefault(),\n` +
        `  fromSubpath(),\n` +
        `  fromPattern(),\n` +
        `  fromConditional(),\n` +
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
        "exports-js-target-ok",
        "main-js-target-ok",
        "default-js-target-ok",
        "subpath-js-target-ok",
        "pattern-js-target-ok",
        "conditional-import-js-target-ok",
      ].join(":"),
    );
  };
