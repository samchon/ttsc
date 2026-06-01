import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx resolves extensionless imports inside a symlinked workspace raw
 * `.ts` dependency.
 *
 * A pnpm-style workspace dependency is a `node_modules` symlink whose realpath
 * lives outside `node_modules`, so Node strips its types natively but rejects
 * the source's extensionless relative imports with `ERR_MODULE_NOT_FOUND`.
 * ttsx's runtime `resolve` hook must probe the candidate extensions and rescue
 * the import without any change to the dependency.
 *
 * 1. Create an ESM project plus a `ws-dep` package whose `index.ts` does `import
 *    "./util"` (no extension), symlinked into `node_modules`.
 * 2. Run ttsx against an entry importing the dependency.
 * 3. Assert the dependency executed and produced its greeting.
 */
export const test_ttsx_resolves_extensionless_imports_in_a_symlinked_workspace_raw_ts_dependency =
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
      "packages/ws-dep/package.json": JSON.stringify({
        name: "ws-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
      }),
      "packages/ws-dep/src/index.ts": `import { greet } from "./util";\nexport const hello = (): string => greet("workspace");\n`,
      "packages/ws-dep/src/util.ts": `export const greet = (who: string): string => \`hello-\${who}\`;\n`,
      "src/main.ts": `import { hello } from "ws-dep";\nconsole.log(hello());\n`,
    });
    fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
    fs.symlinkSync(
      path.join(root, "packages", "ws-dep"),
      path.join(root, "node_modules", "ws-dep"),
      "junction",
    );

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "hello-workspace");
  };
