import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx propagates its source loader to child processes the program
 * spawns itself.
 *
 * Libraries like `tgrid` run work in a separate process started with `node
 * worker.ts`. That child is not launched through ttsx, so it must inherit the
 * hooks another way: ttsx puts the installer on `NODE_OPTIONS` (and the runtime
 * manifest / tsgo binary on the environment), which every descendant inherits —
 * the same mechanism `ts-node` uses with `--require`. The child then runs its
 * own `.ts` entry from source and resolves a raw `.ts` dependency.
 *
 * 1. Create a project whose entry spawns `node worker.ts` with inherited stdio.
 * 2. `worker.ts` imports a published raw `.ts` dependency and prints its value.
 * 3. Assert the child ran and the dependency loaded, surfaced through the parent.
 */
export const test_ttsx_propagates_the_source_loader_to_a_child_process = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        esModuleInterop: true,
      },
      include: ["src"],
    }),
    "node_modules/worker-dep/package.json": JSON.stringify({
      name: "worker-dep",
      version: "1.0.0",
      main: "index.ts",
      types: "index.ts",
    }),
    "node_modules/worker-dep/index.ts": `export const value: string = "child-loaded-dependency";\n`,
    "src/node.d.ts": [
      `declare const __dirname: string;`,
      `declare const process: { execPath: string; exit(code: number): never };`,
      `declare function require(name: "node:child_process"): {`,
      `  spawnSync(`,
      `    command: string,`,
      `    args: string[],`,
      `    options: { stdio: string },`,
      `  ): { status: number | null };`,
      `};`,
      ``,
    ].join("\n"),
    "src/worker.ts": [
      `import { value } from "worker-dep";`,
      `declare const console: { log(message: string): void };`,
      `console.log("worker:" + value);`,
      ``,
    ].join("\n"),
    "src/main.ts": [
      `const { spawnSync } = require("node:child_process");`,
      `const result = spawnSync(`,
      `  process.execPath,`,
      `  [__dirname + "/worker.ts"],`,
      `  { stdio: "inherit" },`,
      `);`,
      `process.exit(result.status ?? 1);`,
      ``,
    ].join("\n"),
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "worker:child-loaded-dependency");
};
