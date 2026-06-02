import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx maps a scoped package's published `.js` exports target back to
 * its raw `.ts` source.
 *
 * Scoped specifiers (`@scope/name`) take a different parse path than unscoped
 * ones (the package name spans two path segments), so a regression in the scope
 * handling would only surface for scoped packages, which dominate real
 * registries. This pins the scoped twin of the unscoped exports-target rescue.
 *
 * 1. Install `@scope/dep` whose `exports` points at an unbuilt `.js`, shipping
 *    only the `.ts` source.
 * 2. Import `@scope/dep` from an ESM entry.
 * 3. Assert the compiled `.ts` source ran.
 */
export const test_ttsx_resolves_a_scoped_package_exports_target_to_raw_typescript_source =
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
      "node_modules/@scope/dep/package.json": JSON.stringify({
        name: "@scope/dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./dist/index.js" },
      }),
      "node_modules/@scope/dep/dist/index.ts": `export const value = (): string => "scoped-target-ok";\n`,
      "src/main.ts": `import { value } from "@scope/dep";\nconsole.log(value());\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "scoped-target-ok");
  };
