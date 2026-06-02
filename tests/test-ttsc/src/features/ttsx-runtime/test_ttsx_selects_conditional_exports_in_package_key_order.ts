import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx selects a conditional `exports` branch in the package's own key
 * order, matching Node, when rescuing a `.js` target to its `.ts` source.
 *
 * Node resolves a conditions object by the first key, in object insertion
 * order, that is an active condition, not the first active condition in the
 * resolver's priority list. So `{ "node": ..., "import": ... }` resolves
 * through `node` even for an ESM import. ttsx re-derives the target when the
 * published `.js` is missing, so it must mirror that key-order selection or it
 * would serve the wrong branch's source.
 *
 * 1. Install an ESM dependency whose root export lists `node` before `import`,
 *    both pointing at unbuilt `.js` files with `.ts` sources beside them.
 * 2. Import the dependency from an ESM entry.
 * 3. Assert the `node`-branch source ran, not the `import`-branch source.
 */
export const test_ttsx_selects_conditional_exports_in_package_key_order =
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
      "node_modules/cond-dep/package.json": JSON.stringify({
        name: "cond-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": { node: "./node.js", import: "./import.js" } },
      }),
      "node_modules/cond-dep/node.ts": `export const value = (): string => "node-branch";\n`,
      "node_modules/cond-dep/import.ts": `export const value = (): string => "import-branch";\n`,
      "src/main.ts": `import { value } from "cond-dep";\nconsole.log(value());\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "node-branch");
  };
