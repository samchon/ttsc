import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  forceTerminate,
  isRunning,
  runtimeRunsDirectory,
} from "../../internal/ttsx-run";

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
 */
export const test_ttsx_keeps_runtime_output_for_a_registered_descendant =
  async (): Promise<void> => {
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
        { cwd: root },
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
        { cwd: root },
      );
      assert.equal(finished.status, 0, finished.stderr);
      assert.equal(fs.existsSync(path.dirname(runs)), false);
    } finally {
      await forceTerminate(pid);
    }
  };
