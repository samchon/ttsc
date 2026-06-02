import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs CommonJS emit inside a `type: "module"` package as
 * CommonJS.
 *
 * Ttsx serves compiler output as the module bytes. When tsgo emits CommonJS
 * (`exports.*`, `require(...)`) for a `.ts` file, that output must run as
 * CommonJS even if the nearest package.json says `type: "module"`. Otherwise
 * generated CommonJS helper files crash with `exports is not defined`.
 *
 * 1. Create a `type: "module"` raw dependency whose tsconfig emits CommonJS.
 * 2. Import the dependency from an ESM entry.
 * 3. Assert the CommonJS emit executes instead of being parsed as ESM.
 */
export const test_ttsx_runs_commonjs_emit_inside_a_type_module_package = () => {
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
    "node_modules/cjs-emit-dep/package.json": JSON.stringify({
      name: "cjs-emit-dep",
      version: "1.0.0",
      type: "module",
      exports: { ".": "./index.ts" },
    }),
    "node_modules/cjs-emit-dep/tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "lib",
        rootDir: ".",
      },
      include: ["index.ts"],
    }),
    "node_modules/cjs-emit-dep/index.ts": `export const value: string = "commonjs-emit-ok";\n`,
    "src/main.ts": `import { value } from "cjs-emit-dep";\nconsole.log(value);\n`,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    {
      cwd: root,
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "commonjs-emit-ok");
};
