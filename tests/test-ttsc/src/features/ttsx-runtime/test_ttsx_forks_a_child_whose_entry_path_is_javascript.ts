import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx rescues a `.js` entry path back to its `.ts` source when a
 * program forks a child whose main module is named with a `.js` extension.
 *
 * Libraries like `tgrid` (used by `@nestia/benchmark`) fork a servant via
 * `child_process.fork(__dirname + "/servant.js")` — a `.js` path. Under
 * run-from-source `__dirname` is the source tree, which ships only the `.ts`,
 * so the child's main module would die with `Cannot find module servant.js`. A
 * tgrid master then waits on the dead child's handshake forever (the benchmark
 * CI job hung until the 60-minute timeout). The resolve hook must map the
 * absolute `.js` main entry — which reaches the hook with no `parentURL` — to
 * its `.ts` source.
 *
 * 1. Create a project whose entry forks `node child.js`, but only `child.ts`
 *    exists on disk.
 * 2. Assert the forked child started (its `.ts` was rescued and run) and the
 *    parent saw it exit cleanly.
 */
export const test_ttsx_forks_a_child_whose_entry_path_is_javascript = () => {
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
    "src/node.d.ts": [
      `declare const __dirname: string;`,
      `declare const process: {`,
      `  stdout: { write(text: string): void };`,
      `  exit(code: number): never;`,
      `};`,
      `interface ForkedChild {`,
      `  on(event: "exit", listener: (code: number | null) => void): void;`,
      `}`,
      `declare function require(name: "node:child_process"): {`,
      `  fork(modulePath: string, options: { stdio: string }): ForkedChild;`,
      `};`,
      ``,
    ].join("\n"),
    "src/child.ts": [
      `process.stdout.write("child:rescued-from-source");`,
      ``,
    ].join("\n"),
    "src/main.ts": [
      `const { fork } = require("node:child_process");`,
      `const child = fork(__dirname + "/child.js", { stdio: "inherit" });`,
      `child.on("exit", (code) => process.exit(code ?? 1));`,
      ``,
    ].join("\n"),
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "child:rescued-from-source");
};
