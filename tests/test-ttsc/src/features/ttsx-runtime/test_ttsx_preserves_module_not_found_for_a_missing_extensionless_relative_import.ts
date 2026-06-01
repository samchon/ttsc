import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx preserves `ERR_MODULE_NOT_FOUND` for a missing extensionless
 * relative import.
 *
 * The `resolve` hook only rescues specifiers it can map to a real file; when no
 * candidate extension matches it must rethrow Node's original error rather than
 * masking it. A computed dynamic import bypasses the up-front compile gate so
 * the failure surfaces at runtime, exactly where the hook runs.
 *
 * 1. Create an ESM entry that dynamically imports a computed `"./missing"`
 *    specifier with no matching file.
 * 2. Run ttsx against the entry.
 * 3. Assert it exits non-zero with `ERR_MODULE_NOT_FOUND`.
 */
export const test_ttsx_preserves_module_not_found_for_a_missing_extensionless_relative_import =
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
      "src/main.ts": `export {};\nconst specifier: string = "./mis" + "sing";\nawait import(specifier);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ERR_MODULE_NOT_FOUND/);
  };
