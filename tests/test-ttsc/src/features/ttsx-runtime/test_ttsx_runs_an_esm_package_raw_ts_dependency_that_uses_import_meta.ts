import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx loads a raw `.ts` dependency that uses `import.meta` from an
 * ESM package as a module.
 *
 * `import.meta` is only valid inside an ES module. A dependency that uses it
 * declares `type: "module"`; ttsx classifies each served file by that package
 * `type` (and file extension) — never by sniffing the source — so the file is
 * loaded as a module and `import.meta.url` is a real value.
 *
 * 1. Install a published `meta-dep` with `type: "module"` whose `.ts` entry uses
 *    `import.meta.url`.
 * 2. Run ttsx against an entry that imports it for side effect.
 * 3. Assert the dependency ran as a module and saw a real `import.meta.url`.
 */
export const test_ttsx_runs_an_esm_package_raw_ts_dependency_that_uses_import_meta =
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
        type: "module",
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
