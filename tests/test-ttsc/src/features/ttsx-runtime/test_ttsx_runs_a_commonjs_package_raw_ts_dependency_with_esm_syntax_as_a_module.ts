import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx loads a CommonJS-package raw `.ts` dependency that uses ESM
 * syntax as a module.
 *
 * Type-stripping never rewrites module syntax, so a `.ts` file authored with
 * `import`/`export` stays ESM even when its package omits `type: module`.
 * Labelling it CommonJS (the package baseline) would make Node reject its named
 * exports, so the `load` hook's format decision lets unambiguous ESM syntax
 * override the CommonJS baseline, matching Node's own module-syntax detection.
 *
 * 1. Install a published `pub-dep` with no `type` field whose `.ts` source uses
 *    ESM `export`.
 * 2. Run ttsx against an entry that imports a named export from it.
 * 3. Assert the named export resolved and executed.
 */
export const test_ttsx_runs_a_commonjs_package_raw_ts_dependency_with_esm_syntax_as_a_module =
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
      "node_modules/pub-dep/package.json": JSON.stringify({
        name: "pub-dep",
        version: "1.0.0",
        exports: { ".": "./index.ts" },
      }),
      "node_modules/pub-dep/index.ts": `export const detect = (): string => "detected-as-module";\n`,
      "src/main.ts": `import { detect } from "pub-dep";\nconsole.log(detect());\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "detected-as-module");
  };
