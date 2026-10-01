import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Verifies a child process that lost the runtime manifest runs the source as it
 * is now on the next run, and leaves no cache behind.
 *
 * Pins samchon/ttsc#1405. A child whose environment drops
 * `TTSX_RUNTIME_MANIFEST` still has the runtime hooks, but no run to share a
 * cache with. Its project builds went to a persistent, shared temp directory
 * keyed only by the tsconfig path, so after the source was edited the child
 * kept running its first build until the temp directory was cleared. Such a
 * child now builds into a directory private to its own process, removed when it
 * exits.
 *
 * 1. Create a project whose entry spawns `node src/child.ts` without the manifest,
 *    and prints what the child printed along with its pid.
 * 2. Run it, edit `src/child.ts`, and run it again.
 * 3. Assert each run prints its own version, and that no private cache directory
 *    of either child remains.
 * @evidence contracts/testing.md#behavioral-verification Two parent ttsx runs each spawn a Node child with runtime manifest removed; child v1/v2 output must match rewritten source and neither observed PID may leave a process-PID cache directory.
 * @evidence contracts/testing.md#independent-expectations The authored version bytes determine fresh execution; observed child PID plus literal private cache prefix independently identifies cleanup targets.
 * @evidence contracts/testing.md#distinguishing-cases Manifest-less child differs from inherited shared-run ownership. Two source versions at one path must not reuse the first lowering, and both child-private cache owners must be gone.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsx_manifest_less_child_runs_the_edited_source_on_the_next_run E2E entry owns the actual bootstrap and observations specified here. TestProject/internal helpers supply fixtures and completed process results; this acknowledgment does not infer portable unit coverage from similarly named tests.
 * @evidence contracts/e2e.md#necessary-boundary Actual inherited hooks, removed manifest, child process exit and filesystem cleanup connect here. Direct cache-key/lifetime units cannot prove the child executes edited source and releases its directories.
 * @evidence contracts/e2e.md#shared-execution Two parent and two child lifetimes share one project. Separate runs are necessary for cross-run source invalidation; child-private generation state cannot be shared merely because tsconfig path is equal.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The full child bytes are rewritten before each synchronous parent run. Runtime owns each child-private cache; the test observes cleanup after both children exit and TestProject owns fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original version/status checks and both PID-prefix absence checks remain. Only the named historical ttsx-dep cache parent is inspected, not arbitrary leaked directories.
 */
export function test_ttsx_manifest_less_child_runs_the_edited_source_on_the_next_run() {
    const child = (version: string): string =>
      [
        `declare const process: { pid: number };`,
        `const version: string = "${version}";`,
        `console.log(version + ":" + process.pid);`,
        `export {};`,
        ``,
      ].join("\n");
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "manifest-less", private: true }),
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
      "src/main.ts": [
        `declare const require: (id: string) => any;`,
        `declare const process: { env: Record<string, string | undefined>; execPath: string };`,
        `declare const __dirname: string;`,
        `const { spawnSync } = require("node:child_process");`,
        `const path = require("node:path");`,
        `const env = { ...process.env };`,
        `delete env.TTSX_RUNTIME_MANIFEST;`,
        `const result = spawnSync(process.execPath, [path.join(__dirname, "child.ts")], { env, encoding: "utf8" });`,
        `if (result.status !== 0) throw new Error(result.stderr);`,
        `console.log(result.stdout.trim());`,
        `export {};`,
        ``,
      ].join("\n"),
      "src/child.ts": child("v1"),
    });

    const pids: string[] = [];
    for (const version of ["v1", "v2"]) {
      TestProject.writeFiles(root, { "src/child.ts": child(version) });
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, "src/main.ts"],
        { cwd: root },
      );
      assert.equal(result.status, 0, result.stderr);
      const [printed, pid] = result.stdout.trim().split(":");
      assert.equal(printed, version);
      pids.push(pid!);
    }

    const parent = path.join(os.tmpdir(), "ttsx-dep");
    const remaining = fs.existsSync(parent) ? fs.readdirSync(parent) : [];
    for (const pid of pids) {
      assert.deepEqual(
        remaining.filter((name) => name.startsWith(`process-${pid}-`)),
        [],
        `the child ${pid} left its private cache behind`,
      );
    }
  }
