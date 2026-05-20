import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx rewrites extensionless ESM directory index imports.
 *
 * TypeScript's `bundler` module resolution allows `import "./pkg"` to resolve
 * to `./pkg/index.ts`. The emitted JS contains `import "./pkg"` without an
 * extension, which Node.js ESM cannot load. ttsx must resolve the directory to
 * its `index.js` and rewrite the specifier before executing.
 *
 * 1. Create an ESM project where `main.ts` imports `"./pkg"` (no extension).
 * 2. Run ttsx against the entry.
 * 3. Assert the directory-index module was loaded successfully.
 */
export const test_ttsx_rewrites_extensionless_esm_directory_index_imports =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module" }),
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
      "src/pkg/index.ts": `export const message: string = "directory-index-ok";\n`,
      "src/main.ts": `import { message } from "./pkg";\nconsole.log(message);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "directory-index-ok");
  };
