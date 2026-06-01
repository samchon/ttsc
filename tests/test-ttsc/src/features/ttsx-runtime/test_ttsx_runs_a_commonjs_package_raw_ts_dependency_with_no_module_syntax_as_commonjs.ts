import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx loads a CommonJS-package raw `.ts` dependency that has no
 * module syntax as CommonJS.
 *
 * When a `node_modules` `.ts` file declares no `import`/`export` and its
 * package omits `type: module`, there is no ESM syntax to override the CommonJS
 * baseline, so the `load` hook must label it `commonjs`. This is the negative
 * twin of the ESM-syntax detection case: the format decision must fall through
 * to CommonJS rather than defaulting to a module.
 *
 * 1. Install a published `se-dep` with no `type` field whose `.ts` entry only runs
 *    a side effect (no `import`/`export`).
 * 2. Run ttsx against an entry that imports it for side effect.
 * 3. Assert the side effect ran.
 */
export const test_ttsx_runs_a_commonjs_package_raw_ts_dependency_with_no_module_syntax_as_commonjs =
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
      "node_modules/se-dep/package.json": JSON.stringify({
        name: "se-dep",
        version: "1.0.0",
        exports: { ".": "./effect.ts" },
      }),
      "node_modules/se-dep/effect.ts": `const tag: string = "side-effect-ran";\n(globalThis as Record<string, unknown>).__seDep = tag;\n`,
      "src/main.ts": `import "se-dep";\nconsole.log((globalThis as Record<string, unknown>).__seDep);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "side-effect-ran");
  };
