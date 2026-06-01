import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx loads a CommonJS-package raw `.ts` dependency that uses
 * `import.meta` as a module.
 *
 * `import.meta` is a syntax error outside an ES module, yet a `.ts` file can
 * use it without any top-level `import`/`export` statement. The `load` hook's
 * format decision must treat `import.meta` as an ESM marker (as Node's own
 * module detection does); otherwise the file is mislabeled `commonjs` and
 * crashes with "Cannot use 'import.meta' outside a module".
 *
 * 1. Install a published `meta-dep` with no `type` field whose `.ts` entry uses
 *    `import.meta.url` and no `import`/`export` statement.
 * 2. Run ttsx against an entry that imports it for side effect.
 * 3. Assert the dependency ran as a module and saw a real `import.meta.url`.
 */
export const test_ttsx_runs_a_commonjs_package_raw_ts_dependency_that_uses_import_meta_as_a_module =
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
      "node_modules/meta-dep/package.json": JSON.stringify({
        name: "meta-dep",
        version: "1.0.0",
        exports: { ".": "./effect.ts" },
      }),
      "node_modules/meta-dep/effect.ts": `const here: string = import.meta.url;\n(globalThis as Record<string, unknown>).__metaDep = here.startsWith("file:")\n  ? "meta-ok"\n  : "meta-bad";\n`,
      "src/main.ts": `import "meta-dep";\nconsole.log((globalThis as Record<string, unknown>).__metaDep);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "meta-ok");
  };
