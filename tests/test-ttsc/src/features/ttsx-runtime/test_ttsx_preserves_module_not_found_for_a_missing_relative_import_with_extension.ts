import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx preserves `ERR_MODULE_NOT_FOUND` for a missing relative import
 * that already carries an extension.
 *
 * A specifier that already names a concrete extension needs no probing, so the
 * `resolve` hook must not interfere: it rethrows Node's original error instead
 * of appending more extensions. This pins the concrete-extension branch as
 * distinct from the extensionless rescue path.
 *
 * 1. Create an ESM entry that dynamically imports a computed `"./missing.ts"`
 *    specifier with no matching file.
 * 2. Run ttsx against the entry.
 * 3. Assert it exits non-zero with `ERR_MODULE_NOT_FOUND`.
 */
export const test_ttsx_preserves_module_not_found_for_a_missing_relative_import_with_extension =
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
      "src/main.ts": `export {};\nconst specifier: string = "./mis" + "sing.ts";\nawait import(specifier);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ERR_MODULE_NOT_FOUND/);
  };
