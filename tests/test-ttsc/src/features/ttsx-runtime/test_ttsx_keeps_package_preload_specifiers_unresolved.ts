import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx keeps package preload specifiers unresolved.
 *
 * This ttsx runtime toolchain scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsx_keeps_package_preload_specifiers_unresolved = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "node_modules/@scope/preload/index.js": `
      globalThis.__ttsxScopedPreload = "scoped";
    `,
    "node_modules/plain-preload/package.json": JSON.stringify({
      name: "plain-preload",
      version: "1.0.0",
    }),
    "node_modules/plain-preload/register.js": `
      globalThis.__ttsxSubpathPreload = "subpath";
    `,
    "src/main.ts": `
      console.log(JSON.stringify({
        scoped: (globalThis as any).__ttsxScopedPreload,
        subpath: (globalThis as any).__ttsxSubpathPreload,
      }));
    `,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    [
      "--cwd",
      root,
      "-r",
      "@scope/preload",
      "--require",
      "plain-preload/register",
      "src/main.ts",
    ],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    scoped: "scoped",
    subpath: "subpath",
  });
};
