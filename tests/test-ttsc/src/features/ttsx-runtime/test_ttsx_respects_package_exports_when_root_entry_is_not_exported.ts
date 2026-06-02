import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx does not fall back to `main` or default `index.js` when package
 * `exports` omits the root entry.
 *
 * The package exports map is authoritative in Node. Even if `index.ts` exists
 * beside `package.json`, importing the package root must fail when `exports`
 * only exposes a subpath. ttsx's JavaScript-target rescue must therefore stay
 * tied to targets Node actually selected, not invent a legacy fallback.
 *
 * 1. Install a package with `exports` for `./tool` only and a root `index.ts`.
 * 2. Dynamically import the package root through ttsx.
 * 3. Assert Node's package-exports error is preserved.
 */
export const test_ttsx_respects_package_exports_when_root_entry_is_not_exported =
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
      "node_modules/closed-dep/package.json": JSON.stringify({
        name: "closed-dep",
        version: "1.0.0",
        type: "module",
        exports: { "./tool": "./tool.js" },
      }),
      "node_modules/closed-dep/index.ts": `export const value = "should-not-load";\n`,
      "node_modules/closed-dep/tool.ts": `export const value = "subpath-only";\n`,
      "src/main.ts": `export {};\nconst name: string = "closed-" + "dep";\nawait import(name);\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ERR_PACKAGE_PATH_NOT_EXPORTED/);
  };
