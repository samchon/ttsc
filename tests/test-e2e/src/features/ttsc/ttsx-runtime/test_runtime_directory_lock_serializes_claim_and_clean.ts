import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import nodeChildProcessForTrace from "node:child_process";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const childProcess = { ...nodeChildProcessForTrace, ...E2eProcessTrace };
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
 *
 * @evidence contracts/testing.md#behavioral-verification Two real workers call withRuntimeDirectoryLock on one runtime path; the contender must not enter while held, and both workers must exit successfully after release with an entry marker.
 * @evidence contracts/testing.md#independent-expectations Explicit ready, attempting, release and entered fixture barriers establish ordering; native process outcomes and marker existence are independent of lock record decoding.
 * @evidence contracts/testing.md#distinguishing-cases The blocked contender and subsequently admitted contender distinguish exclusion from permanent blocking; dead predecessor recovery belongs to the public clean recovery case.
 * @evidence contracts/testing.md#execution-ownership The matching named async E2E entry owns both actual process roles and captures each exit; generated worker source is fixture input, not another registered testcase.
 * @evidence contracts/e2e.md#necessary-boundary Interprocess filesystem lock exclusion cannot be demonstrated by sequential direct calls in one host; this case does not itself run claim or clean commands.
 * @evidence contracts/e2e.md#shared-execution One worker script and runtime directory serve two necessary process lifetimes, holder and contender; no compiler build or consumer installation occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Holder acquisition and both readiness waits are protected by one finally that releases the barrier and settles every acquired worker. Each test-owned worker has a bounded kill deadline; cleanup failures are reported alongside the original assertion failure.
 * @evidence contracts/e2e.md#preserved-coverage Blocked-entry, both zero exits and eventual entry assertions stay here. The 300ms non-entry observation is a bounded witness, not proof over every scheduling interval.
 */
export async function test_runtime_directory_lock_serializes_claim_and_clean(): Promise<void> {
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
        timeout: 120_000,
        killSignal: "SIGKILL",
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
    const waits = new AbortController();
    const waitFor = async (file: string): Promise<void> => {
      const deadline = Date.now() + 30_000;
      while (!fs.existsSync(file)) {
        if (waits.signal.aborted) return;
        assert.ok(Date.now() < deadline, `worker did not write ${file}`);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    };

    const workers: Promise<{ code: number | null; output: string }>[] = [];
    const failures: unknown[] = [];
    let results: PromiseSettledResult<{ code: number | null; output: string }>[] = [];
    try {
      const holder = start("holder");
      workers.push(holder);
      await Promise.race([
        waitFor(ready),
        holder.then(({ code, output }) => {
          throw new Error(`holder exited before claiming: ${code}\n${output}`);
        }),
      ]);
      const contender = start("contender");
      workers.push(contender);
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
    } catch (error) {
      failures.push(error);
    } finally {
      waits.abort();
      try {
        fs.writeFileSync(release, "release", "utf8");
      } catch (error) {
        failures.push(error);
      } finally {
        results = await Promise.allSettled(workers);
        for (const result of results) if (result.status === "rejected") failures.push(result.reason);
      }
    }
    if (failures.length !== 0) throw new AggregateError(failures, "runtime lock workers failed");
    const [first, second] = results.map((result) => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    });
    assert.ok(first);
    assert.ok(second);
    assert.equal(first.code, 0, first.output);
    assert.equal(second.code, 0, second.output);
    assert.equal(fs.existsSync(entered), true);
  }
