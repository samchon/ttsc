import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx keeps package preload specifiers unresolved.
 *
 * When `-r` is given a package specifier (e.g. `@scope/preload` or
 * `plain-preload/register`), ttsx must pass it to `require()` as-is so Node's
 * module resolution finds it in the project's `node_modules`. If ttsx
 * incorrectly resolves the specifier to an absolute path relative to its own
 * install location, the require will fail or load a different version.
 *
 * 1. Install scoped and subpath preloads under `node_modules/`.
 * 2. Run ttsx with `-r @scope/preload --require plain-preload/register`.
 * 3. Assert both preloads ran and their globals are visible to the entry.
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
