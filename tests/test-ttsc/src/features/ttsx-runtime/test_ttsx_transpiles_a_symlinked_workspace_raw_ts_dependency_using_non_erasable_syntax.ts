import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx runs a symlinked workspace raw `.ts` dependency whose source
 * uses non-erasable TypeScript syntax (`namespace`, `enum`).
 *
 * A pnpm-style workspace dependency's realpath lives outside `node_modules`, so
 * Node strips its types natively instead of through ttsx's `load` hook. But
 * native stripping only erases type annotations; it rejects `namespace` /
 * `enum` (which need code generation) with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`.
 * Real workspace packages use those constructs, so the `load` hook must catch
 * that failure and fall back to the same transform it already applies under
 * `node_modules` — otherwise the dependency crashes even though it
 * type-checks.
 *
 * 1. Create an ESM project plus a `ns-dep` package whose `index.ts` exports a
 *    `namespace` wrapping an `enum`, symlinked into `node_modules`.
 * 2. Run ttsx against an entry importing the dependency.
 * 3. Assert the dependency executed and the enum-derived value printed.
 */
export const test_ttsx_transpiles_a_symlinked_workspace_raw_ts_dependency_using_non_erasable_syntax =
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
      "packages/ns-dep/package.json": JSON.stringify({
        name: "ns-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
      }),
      "packages/ns-dep/src/index.ts":
        `export enum Tone {\n` +
        `  Low,\n` +
        `  High,\n` +
        `}\n` +
        `export namespace Greeter {\n` +
        `  export const shout = (who: string): string => \`hi-\${who}-\${Tone.High}\`;\n` +
        `}\n`,
      "src/main.ts": `import { Greeter } from "ns-dep";\nconsole.log(Greeter.shout("workspace"));\n`,
    });
    fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
    fs.symlinkSync(
      path.join(root, "packages", "ns-dep"),
      path.join(root, "node_modules", "ns-dep"),
      "junction",
    );

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "hi-workspace-1");
  };
