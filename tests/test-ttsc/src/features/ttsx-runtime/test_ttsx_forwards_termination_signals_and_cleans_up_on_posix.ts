import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx forwards termination signals to the program, reports how it
 * ended the way `node` would, and removes its runtime directory on every such
 * exit. POSIX only: Windows has no signal delivery of this kind.
 *
 * Pins samchon/ttsc#1403. ttsx ran the program with a blocking spawn, so a
 * `SIGTERM` sent to the launcher alone (a supervisor, a container stop) killed
 * the launcher before its cleanup ran, never reached the program, and left the
 * runtime directory behind; a program that died of a signal made ttsx exit 1
 * instead of dying of the same signal.
 *
 * 1. Create a program that prints `ready` and then waits, with or without a
 *    `SIGTERM`/`SIGINT` handler that exits 3.
 * 2. Send `SIGTERM` to the launcher's pid alone, and `SIGINT` to its process
 *    group, once the program is ready.
 * 3. Assert the handler ran and its code came back, an unhandled `SIGTERM`
 *    ended ttsx by `SIGTERM`, and no runtime directory remains.
 */
export const test_ttsx_forwards_termination_signals_and_cleans_up_on_posix =
  async () => {
    if (process.platform === "win32") return;
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "signals", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      }),
      "src/handled.ts": program(true),
      "src/unhandled.ts": program(false),
    });
    const runtimeRoot = path.join(
      root,
      "node_modules",
      ".cache",
      "ttsc",
      "ttsx",
      "project",
    );

    const handled = await runUntilSignaled(root, "src/handled.ts", (child) =>
      child.kill("SIGTERM"),
    );
    assert.equal(handled.code, 3, handled.output);
    assert.match(handled.output, /handled SIGTERM/);
    assert.deepEqual(listDirectory(runtimeRoot), []);

    const unhandled = await runUntilSignaled(
      root,
      "src/unhandled.ts",
      (child) => child.kill("SIGTERM"),
    );
    assert.equal(unhandled.signal, "SIGTERM", unhandled.output);
    assert.deepEqual(listDirectory(runtimeRoot), []);

    const group = await runUntilSignaled(root, "src/handled.ts", (child) =>
      process.kill(-child.pid!, "SIGINT"),
    );
    assert.equal(group.code, 3, group.output);
    assert.match(group.output, /handled SIGINT/);
    assert.equal(
      group.output.match(/handled SIGINT/g)?.length,
      1,
      "SIGINT must reach the program once",
    );
    assert.deepEqual(listDirectory(runtimeRoot), []);
  };

/** A program that prints `ready`, then waits, handling signals if asked. */
function program(handles: boolean): string {
  return [
    `declare const process: { on(event: string, listener: (signal: string) => void): void; exit(code: number): never };`,
    `declare function setInterval(callback: () => void, ms: number): unknown;`,
    ...(handles
      ? [
          `for (const signal of ["SIGTERM", "SIGINT"]) {`,
          `  process.on(signal, (received) => {`,
          `    console.log("handled " + received);`,
          `    process.exit(3);`,
          `  });`,
          `}`,
        ]
      : []),
    `console.log("ready");`,
    `setInterval(() => {}, 1000);`,
    `export {};`,
    ``,
  ].join("\n");
}

/**
 * Start ttsx in its own process group, signal it once the program prints
 * `ready`, and collect how it ended.
 */
function runUntilSignaled(
  root: string,
  entry: string,
  signal: (child: child_process.ChildProcess) => void,
): Promise<{
  code: number | null;
  signal: NodeJS.Signals | null;
  output: string;
}> {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(
      process.execPath,
      [TestProject.TTSX_BIN, "--cwd", root, entry],
      {
        cwd: root,
        detached: true,
        env: {
          ...process.env,
          TTSC_BINARY: TestProject.NATIVE_BINARY,
          TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    let signaled = false;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`ttsx ${entry} did not end:\n${output}`));
    }, 120_000);
    const collect = (chunk: Buffer): void => {
      output += chunk.toString("utf8");
      if (!signaled && output.includes("ready")) {
        signaled = true;
        signal(child);
      }
    };
    child.stdout!.on("data", collect);
    child.stderr!.on("data", collect);
    child.once("error", reject);
    child.once("close", (code, received) => {
      clearTimeout(timer);
      resolve({ code, signal: received, output });
    });
  });
}

function listDirectory(directory: string): string[] {
  return fs.existsSync(directory) ? fs.readdirSync(directory) : [];
}
