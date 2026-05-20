import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx rewrites extensionless ESM side-effect imports.
 *
 * Side-effect-only imports (`import "./setup"`) produce no bindings in the
 * emitted JS. The specifier is extensionless, which Node.js ESM cannot resolve.
 * ttsx must rewrite side-effect import specifiers to `.js` just as it does for
 * value imports.
 *
 * 1. Create an ESM project with a side-effect import `import "./setup"`.
 * 2. Run ttsx against the entry.
 * 3. Assert the side-effect module ran (global flag visible to the entry).
 */
export const test_ttsx_rewrites_extensionless_esm_side_effect_imports = () => {
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
    "src/setup.ts": `
      export {};
      declare global { var __ttsxSideEffect: string | undefined; }
      globalThis.__ttsxSideEffect = "side-effect-import-ok";
    `,
    "src/main.ts": `import "./setup";\nconsole.log(globalThis.__ttsxSideEffect);\n`,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "side-effect-import-ok");
};
