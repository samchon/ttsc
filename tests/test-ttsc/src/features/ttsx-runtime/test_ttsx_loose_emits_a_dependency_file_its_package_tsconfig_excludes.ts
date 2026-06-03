import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies `ttsx` loose-compiles a raw dependency file its own package tsconfig
 * excludes.
 *
 * A published package may ship a `tsconfig` scoped to a subset of its sources
 * (here only `types/`), yet an importer reaches `index.ts` directly. The owning
 * program parses the file but emits nothing for it, so the runner falls back to
 * a loose single-file compile and runs it, rather than failing the way an
 * all-or-nothing project build would.
 *
 * 1. Install `excluded-dep` whose `tsconfig` includes only a declaration file.
 * 2. Run `ttsx` against an entry importing its `index.ts`.
 * 3. Assert the dependency ran through the loose fallback.
 */
export const test_ttsx_loose_emits_a_dependency_file_its_package_tsconfig_excludes =
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
      "node_modules/excluded-dep/package.json": JSON.stringify({
        name: "excluded-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./index.ts" },
      }),
      // The package tsconfig includes only `types`, so `index.ts` — the file the
      // importer resolves — is outside its program.
      "node_modules/excluded-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          outDir: "lib",
        },
        include: ["types"],
      }),
      "node_modules/excluded-dep/types/only.d.ts": `export declare const value: string;\n`,
      "node_modules/excluded-dep/index.ts": `export const run = (): string => "ran";\n`,
      "src/main.ts": `import { run } from "excluded-dep";\nconsole.log(run());\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "ran");
  };
