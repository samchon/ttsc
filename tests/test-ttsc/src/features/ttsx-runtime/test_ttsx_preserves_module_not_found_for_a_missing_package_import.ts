import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx preserves `ERR_MODULE_NOT_FOUND` for a missing bare package
 * import.
 *
 * The `resolve` hook's extension probing is scoped to relative specifiers; a
 * bare package specifier is none of its business, so it must rethrow Node's
 * original resolution error untouched. This pins the non-relative branch of the
 * rescue logic.
 *
 * 1. Create an ESM entry that dynamically imports a computed bare specifier for a
 *    package that is not installed.
 * 2. Run ttsx against the entry.
 * 3. Assert it exits non-zero with `ERR_MODULE_NOT_FOUND`.
 */
export const test_ttsx_preserves_module_not_found_for_a_missing_package_import =
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
      "src/main.ts": `export {};\nconst specifier: string = "no-such-" + "package-xyz";\nawait import(specifier);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ERR_MODULE_NOT_FOUND/);
  };
