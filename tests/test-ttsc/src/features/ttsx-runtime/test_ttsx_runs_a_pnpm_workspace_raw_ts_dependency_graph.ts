import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx runs a pnpm-style workspace graph where raw `.ts` packages
 * import each other through bare package specifiers.
 *
 * The entry imports `pkg-a` from root `node_modules`, then `pkg-a` imports
 * `pkg-b` through its own `node_modules` symlink. Both packages expose raw
 * `.ts` sources, and the transitive package also uses extensionless relative
 * imports plus a non-erasable `enum`. ttsx must compile and serve every package
 * in the graph, not only the package imported directly by the entry.
 *
 * 1. Create an ESM project with `pkg-a` and `pkg-b` workspace packages.
 * 2. Link `pkg-a` from the root and `pkg-b` from `pkg-a/node_modules`.
 * 3. Run ttsx against an entry importing `pkg-a`.
 * 4. Assert the transitive raw TypeScript package executed.
 */
export const test_ttsx_runs_a_pnpm_workspace_raw_ts_dependency_graph = () => {
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
    "packages/pkg-a/package.json": JSON.stringify({
      name: "pkg-a",
      version: "1.0.0",
      type: "module",
      exports: { ".": "./src/index.ts" },
      dependencies: { "pkg-b": "workspace:*" },
    }),
    "packages/pkg-a/src/index.ts":
      `import { makeTone } from "pkg-b";\n` +
      `import { local } from "./local";\n` +
      `export const message = (): string => local(makeTone("graph"));\n`,
    "packages/pkg-a/src/local.ts": `export const local = (value: string): string => \`a-\${value}\`;\n`,
    "packages/pkg-b/package.json": JSON.stringify({
      name: "pkg-b",
      version: "1.0.0",
      type: "module",
      exports: { ".": "./src/index.ts" },
    }),
    "packages/pkg-b/src/index.ts":
      `import { suffix } from "./suffix";\n` +
      `export enum Tone {\n` +
      `  High = "high",\n` +
      `}\n` +
      `export const makeTone = (value: string): string => \`\${value}-\${Tone.High}-\${suffix}\`;\n`,
    "packages/pkg-b/src/suffix.ts": `export const suffix = "b";\n`,
    "src/main.ts": `import { message } from "pkg-a";\nconsole.log(message());\n`,
  });
  fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
  fs.mkdirSync(path.join(root, "packages", "pkg-a", "node_modules"), {
    recursive: true,
  });
  fs.symlinkSync(
    path.join(root, "packages", "pkg-a"),
    path.join(root, "node_modules", "pkg-a"),
    "junction",
  );
  fs.symlinkSync(
    path.join(root, "packages", "pkg-b"),
    path.join(root, "packages", "pkg-a", "node_modules", "pkg-b"),
    "junction",
  );

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "a-graph-high-b");
};
