import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a runtime claim and clean enter one filesystem transaction at a
 * time.
 *
 * The owner record is written after its run directory is created. Without a
 * shared lock, clean can inspect that interval as an old unowned run and remove
 * it. The lock is fenced so each process enters only after its predecessor
 * releases, while a dead predecessor can be reclaimed.
 *
 * 1. Hold the runtime lock in one process until a release file appears.
 * 2. Start another process that attempts the same lock.
 * 3. Assert it enters only after the first process releases.
 */
export const test_runtime_directory_lock_serializes_claim_and_clean =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-runtime-lock-");
    const runtime = path.join(root, "ttsx");
    const ready = path.join(root, "ready");
    const attempting = path.join(root, "attempting");
    const release = path.join(root, "release");
    const entered = path.join(root, "entered");
    const worker = path.join(root, "worker.cjs");
    const modulePath = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "lib",
      "launcher",
      "internal",
      "runtime",
      "withRuntimeDirectoryLock.js",
    );
    fs.writeFileSync(
      worker,
      [
        'const fs = require("node:fs");',
        `const { withRuntimeDirectoryLock } = require(${JSON.stringify(modulePath)});`,
        `const runtime = ${JSON.stringify(runtime)};`,
        `const ready = ${JSON.stringify(ready)};`,
        `const attempting = ${JSON.stringify(attempting)};`,
        `const release = ${JSON.stringify(release)};`,
        `const entered = ${JSON.stringify(entered)};`,
        'if (process.argv[2] === "holder") {',
        "  withRuntimeDirectoryLock(runtime, () => {",
        '    fs.writeFileSync(ready, "ready");',
        "    while (!fs.existsSync(release)) {",
        "      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);",
        "    }",
        "  });",
        "} else {",
        '  fs.writeFileSync(attempting, "attempting");',
        "  withRuntimeDirectoryLock(runtime, () => {",
        '    fs.writeFileSync(entered, "entered");',
        "  });",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );
    const start = (
      mode: string,
    ): Promise<{ code: number | null; output: string }> => {
      const child = childProcess.spawn(process.execPath, [worker, mode], {
        cwd: root,
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true,
      });
      let output = "";
      child.stderr?.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf8");
      });
      return new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code) => resolve({ code, output }));
      });
    };
    const waitFor = async (file: string): Promise<void> => {
      const deadline = Date.now() + 30_000;
      while (!fs.existsSync(file)) {
        assert.ok(Date.now() < deadline, `worker did not write ${file}`);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    };

    const holder = start("holder");
    await Promise.race([
      waitFor(ready),
      holder.then(({ code, output }) => {
        throw new Error(`holder exited before claiming: ${code}\n${output}`);
      }),
    ]);
    const contender = start("contender");
    try {
      await Promise.race([
        waitFor(attempting),
        contender.then(({ code, output }) => {
          throw new Error(
            `contender exited before attempting: ${code}\n${output}`,
          );
        }),
      ]);
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.equal(
        fs.existsSync(entered),
        false,
        "the contender bypassed the lock",
      );
    } finally {
      fs.writeFileSync(release, "release", "utf8");
    }
    const [first, second] = await Promise.all([holder, contender]);
    assert.equal(first.code, 0, first.output);
    assert.equal(second.code, 0, second.output);
    assert.equal(fs.existsSync(entered), true);
  };
