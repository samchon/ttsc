import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies a dependency build that emits no JavaScript fails with `ttsx`'s own
 * diagnostic, not a raw filesystem error.
 *
 * Tsgo creates the staging cache directory only as a side effect of emitting
 * into it, so a build whose configured inputs produce no output (here the
 * imported `.ts` is excluded from the package's own `tsconfig`) succeeds
 * without creating it. The hook must still surface a clear "no emitted
 * JavaScript" message naming the cache, rather than crashing with a bare
 * `ENOENT` on the freshness-stamp write.
 *
 * 1. Install an `empty-dep` whose `tsconfig` includes only a declaration file,
 *    excluding the `index.ts` an importer reaches.
 * 2. Run `ttsx` against an entry importing it.
 * 3. Assert a non-zero exit carrying the `ttsx:` no-emit diagnostic, with no raw
 *    stamp-file `ENOENT`.
 */
export const test_ttsx_reports_a_clear_error_when_a_dependency_build_emits_nothing =
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
      "node_modules/empty-dep/package.json": JSON.stringify({
        name: "empty-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./index.ts" },
      }),
      // The build includes only the declaration file, so `index.ts` — the file
      // the importer resolves — is never emitted.
      "node_modules/empty-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          outDir: "lib",
        },
        include: ["types"],
      }),
      "node_modules/empty-dep/types/only.d.ts": `export declare const value: string;\n`,
      "node_modules/empty-dep/index.ts": `export const run = (): string => "ran";\n`,
      "src/main.ts": `import { run } from "empty-dep";\nconsole.log(run());\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.notEqual(result.status, 0, "the run must fail");
    assert.match(result.stderr, /no emitted JavaScript was found/);
    assert.doesNotMatch(result.stderr, /ttsx-stamp/);
  };
