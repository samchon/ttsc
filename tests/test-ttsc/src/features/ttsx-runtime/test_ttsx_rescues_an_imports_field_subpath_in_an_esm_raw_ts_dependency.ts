import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx rescues a Node `imports` (`#`) subpath to its `.ts` source in
 * an ESM raw dependency.
 *
 * A package's own module can import an internal subpath through the `imports`
 * map (`#internal`). When that map's target points at an unbuilt `.js`, the ESM
 * loader reports the resolved-but-missing target, which ttsx maps to the `.ts`
 * source. This pins the working ESM path so the CommonJS twin's fix cannot
 * regress it silently.
 *
 * 1. Install an ESM raw dependency whose `index.ts` imports `#internal`, with the
 *    `imports` map pointing at an unbuilt `.js` and only `internal.ts`.
 * 2. Import the dependency from an ESM entry.
 * 3. Assert the internal `.ts` source ran.
 */
export const test_ttsx_rescues_an_imports_field_subpath_in_an_esm_raw_ts_dependency =
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
      "node_modules/imports-dep/package.json": JSON.stringify({
        name: "imports-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./index.ts" },
        imports: { "#internal": "./internal.js" },
      }),
      "node_modules/imports-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "lib",
          rootDir: ".",
        },
        include: ["index.ts", "internal.ts"],
      }),
      "node_modules/imports-dep/internal.ts": `export const value: string = "imports-field-ok";\n`,
      "node_modules/imports-dep/index.ts":
        `import { value } from "#internal";\n` +
        `export const message: string = value;\n`,
      "src/main.ts": `import { message } from "imports-dep";\nconsole.log(message);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "imports-field-ok");
  };
