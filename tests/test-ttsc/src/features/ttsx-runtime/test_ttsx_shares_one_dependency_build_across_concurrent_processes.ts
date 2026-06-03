import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx builds a dependency once and shares it across concurrent child
 * processes instead of each rebuilding into the same directory.
 *
 * A program can fan out into many processes at once (a benchmark, a worker
 * pool). Each inherits the runtime manifest, so without a shared cache every
 * process would rebuild every dependency — and several would write the same
 * output directory simultaneously and corrupt each other, wedging the run. ttsx
 * keys each dependency build under the shared per-run cache, guarded by a lock,
 * so the first process builds and the rest reuse.
 *
 * 1. Create a project whose entry spawns several `node worker.ts` children at
 *    once; each imports the same raw `.ts` dependency that owns a tsconfig (so
 *    it is built, not type-stripped).
 * 2. Run ttsx against the entry.
 * 3. Assert every concurrent child loaded the dependency and exited cleanly.
 */
export const test_ttsx_shares_one_dependency_build_across_concurrent_processes =
  () => {
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
      "node_modules/shared-dep/package.json": JSON.stringify({
        name: "shared-dep",
        version: "1.0.0",
        main: "src/index.ts",
        types: "src/index.ts",
      }),
      "node_modules/shared-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/shared-dep/src/index.ts": `export const value: string = "shared-built-once";\n`,
      "src/worker.ts": [
        `import { value } from "shared-dep";`,
        `declare const console: { log(message: string): void };`,
        `console.log("worker:" + value);`,
        ``,
      ].join("\n"),
      "src/node.d.ts": [
        `declare const __dirname: string;`,
        `declare const process: { execPath: string; exit(code: number): never };`,
        `interface SpawnedChild {`,
        `  on(event: "exit", listener: (code: number | null) => void): void;`,
        `}`,
        `declare function require(name: "node:child_process"): {`,
        `  spawn(`,
        `    command: string,`,
        `    args: string[],`,
        `    options: { stdio: string },`,
        `  ): SpawnedChild;`,
        `};`,
        ``,
      ].join("\n"),
      "src/main.ts": [
        `const { spawn } = require("node:child_process");`,
        `const run = (): Promise<number> =>`,
        `  new Promise<number>((resolve) => {`,
        `    const child = spawn(`,
        `      process.execPath,`,
        `      [__dirname + "/worker.ts"],`,
        `      { stdio: "inherit" },`,
        `    );`,
        `    child.on("exit", (code) => resolve(code ?? 1));`,
        `  });`,
        `void Promise.all([run(), run(), run()]).then((codes) => {`,
        `  process.exit(codes.every((code) => code === 0) ? 0 : 1);`,
        `});`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim().split("\n").sort().join(","),
      "worker:shared-built-once,worker:shared-built-once,worker:shared-built-once",
    );
  };
