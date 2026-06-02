import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx does not treat `import`/`export` used as object property keys
 * as ES module syntax when detecting a raw dependency's format.
 *
 * `import` and `export` are legal unquoted object keys, and a member access
 * like `value.import` is not a keyword. A scanner that flagged either would
 * misclassify a CommonJS file as ESM, and Node would then load it without
 * `__dirname` / `require`, breaking it. This pins the property-key and
 * member-access cases that the literal-marker tests do not cover.
 *
 * 1. Install a no-`type` raw dependency whose source uses `import`/`export` as
 *    object keys and a member access, and reads `__dirname`.
 * 2. Import it from the entry.
 * 3. Assert the dependency executes as CommonJS.
 */
export const test_ttsx_ignores_import_export_object_keys_when_detecting_module_format =
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
      "node_modules/key-cjs/package.json": JSON.stringify({
        name: "key-cjs",
        version: "1.0.0",
        exports: { ".": "./index.ts" },
      }),
      "node_modules/key-cjs/index.ts":
        `declare const __dirname: string;\n` +
        `const table: Record<string, number> = { import: 1, export: 2 };\n` +
        `const read = table.import + table.export;\n` +
        `(globalThis as Record<string, unknown>).__keyCjs =\n` +
        `  typeof __dirname === "string" && read === 3\n` +
        `    ? "key-cjs-ok"\n` +
        `    : "key-cjs-bad";\n`,
      "src/main.ts":
        `import "key-cjs";\n` +
        `console.log((globalThis as Record<string, unknown>).__keyCjs);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "key-cjs-ok");
  };
