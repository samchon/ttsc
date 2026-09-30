import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { isolatedCacheEnvironment } from "../../../internal/isolated-cache-environment";
import {
  forceTerminate,
  isRunning,
  runtimeRunsDirectory,
} from "../../../internal/ttsx-run";

/**
 * Verifies normal launcher cleanup keeps output a descendant still uses.
 *
 * The program can start another Node process that inherits the runtime hooks
 * and then exit. Removing the run when only the direct child exits breaks a
 * later TypeScript import in the descendant. Each process claims the run before
 * its own code starts, and cleanup removes it only after those owners end.
 *
 * 1. Run a TypeScript entry that starts a detached Node descendant and waits until
 *    that descendant has claimed the run.
 * 2. Clean while the descendant waits and assert its run remains.
 * 3. Let it import TypeScript, then clean and assert the run is removed.
 *
 * @evidence contracts/testing.md#behavioral-verification An actual detached Node descendant claims the runtime run, survives parent exit and clean, then imports lazy.ts; exact result and eventual removal distinguish premature cleanup and permanent retention.
 * @evidence contracts/testing.md#independent-expectations The literal descendant-ready export, ready/release barriers, one live run and eventual absent run are independent process-lifetime expectations.
 * @evidence contracts/testing.md#distinguishing-cases This owns live descendant retention followed by owner completion and cleanup; dead-owner locking and malformed-owner policy have separate owners.
 * @evidence contracts/testing.md#execution-ownership This named filename-matching E2E entry runs the real built launcher or public register and native host. Portable option/cache decisions stay in source units; recursive main24 and the explicit Node compatibility directory both select this actual boundary.
 * @evidence contracts/e2e.md#necessary-boundary An actual detached Node descendant claims the runtime run, survives parent exit and clean, then imports lazy.ts; exact result and eventual removal distinguish premature cleanup and permanent retention. Direct source calls cannot prove this NativeNode loader or process connection.
 * @evidence contracts/e2e.md#shared-execution One launcher preparation is shared by parent and detached worker; two clean calls deliberately bracket its live and finished states, rather than preparing another compiler program.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity An isolated cache and worker-ready barrier prevent warm external owners from deciding cleanup; release permits the real lazy import and finally forceTerminate closes the known worker PID.
 * @evidence contracts/e2e.md#preserved-coverage All original meaningful status, output and state assertions remain in this named entry; physical directory selection removes only repeated unrelated portable cases from floor/current execution, while main24 retains the entire runtime population.
 */
export async function test_ttsx_keeps_runtime_output_for_a_registered_descendant(): Promise<void> {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        name: "runtime-descendant",
        private: true,
      }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          outDir: "lib",
          target: "ES2022",
          types: [],
        },
        include: ["src"],
      }),
      "src/main.ts": [
        "declare const process: any;",
        "declare const require: any;",
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        'const spawn = require("node:child_process").spawn;',
        'const child = spawn(process.execPath, [path.join(process.cwd(), "worker.cjs")], { detached: true, stdio: "ignore" });',
        "child.unref();",
        "const deadline = Date.now() + 30000;",
        "while (!fs.existsSync(process.env.WORKER_READY)) {",
        '  if (Date.now() > deadline) throw new Error("descendant did not start");',
        "  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);",
        "}",
        "console.log(child.pid);",
        "",
      ].join("\n"),
      "src/lazy.ts": 'export const value: string = "descendant-ready";\n',
      "worker.cjs": [
        'const fs = require("node:fs");',
        'fs.writeFileSync(process.env.WORKER_READY, "ready");',
        "const deadline = Date.now() + 30000;",
        "while (!fs.existsSync(process.env.WORKER_RELEASE)) {",
        '  if (Date.now() > deadline) throw new Error("release was not sent");',
        "  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);",
        "}",
        'const { value } = require("./src/lazy.ts");',
        "fs.writeFileSync(process.env.WORKER_RESULT, value);",
        "",
      ].join("\n"),
    });
    const ready = path.join(root, "ready");
    const release = path.join(root, "release");
    const result = path.join(root, "result");
    const run = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
        env: {
          ...isolatedCacheEnvironment(root),
          WORKER_READY: ready,
          WORKER_RELEASE: release,
          WORKER_RESULT: result,
        },
      },
    );
    assert.equal(run.status, 0, run.stderr);
    const pid = Number(run.stdout.trim());
    assert.ok(Number.isSafeInteger(pid) && pid > 0, run.stdout);
    const runs = runtimeRunsDirectory(root);
    try {
      assert.equal(fs.readdirSync(runs).length, 1, "the run was removed early");
      const clean = TestProject.spawn(
        TestProject.TTSC_BIN,
        ["clean", "--cwd", root],
        { cwd: root, env: isolatedCacheEnvironment(root) },
      );
      assert.equal(clean.status, 0, clean.stderr);
      assert.equal(fs.readdirSync(runs).length, 1, clean.stdout);

      fs.writeFileSync(release, "release");
      const deadline = Date.now() + 30_000;
      while (!fs.existsSync(result) || isRunning(pid)) {
        assert.ok(Date.now() < deadline, "descendant did not finish");
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert.equal(fs.readFileSync(result, "utf8"), "descendant-ready");
      const finished = TestProject.spawn(
        TestProject.TTSC_BIN,
        ["clean", "--cwd", root],
        { cwd: root, env: isolatedCacheEnvironment(root) },
      );
      assert.equal(finished.status, 0, finished.stderr);
      assert.equal(fs.existsSync(path.dirname(runs)), false);
    } finally {
      await forceTerminate(pid);
    }
  }
