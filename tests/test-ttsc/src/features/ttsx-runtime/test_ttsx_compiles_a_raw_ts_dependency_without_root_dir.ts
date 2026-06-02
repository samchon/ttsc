import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx compiles a raw TypeScript dependency whose tsconfig omits
 * `rootDir`.
 *
 * Dependency builds always emit into a private cache directory. Passing an
 * `outDir` to tsgo without an explicit `rootDir` triggers TS5011, so ttsx must
 * supply a runtime-only rootDir default for the dependency build instead of
 * requiring package authors to write one.
 *
 * 1. Create an entry project that imports a raw `.ts` dependency.
 * 2. Give the dependency a tsconfig with `outDir` but no `rootDir`.
 * 3. Assert `ttsx` compiles the dependency cache and runs the import.
 */
export const test_ttsx_compiles_a_raw_ts_dependency_without_root_dir = () => {
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
      exports: { ".": "./src/index.ts" },
    }),
    "node_modules/raw-dep/tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ES2022",
        moduleResolution: "bundler",
        strict: true,
        outDir: "lib",
      },
      include: ["src"],
    }),
    "node_modules/raw-dep/src/index.ts":
      `import { value } from "./shared/value";\n` +
      `export const message: string = value;\n`,
    "node_modules/raw-dep/src/shared/value.ts": `export const value: string = "dep-no-rootdir-ok";\n`,
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
  assert.equal(result.stdout.trim(), "dep-no-rootdir-ok");
};
