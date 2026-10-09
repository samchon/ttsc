import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

import { SourceNativeRetirement } from "../../../../../packages/ttsc/src/internal/SourceNativeRetirement";
import { PluginBuildLockProtocol } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildLockProtocol";
import { acquirePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/acquirePluginBuildLock";
import { releasePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/releasePluginBuildLock";
import { TestProject } from "../../../../utils/src/TestProject";
import { waitFor } from "../../../../utils/src/internal/waitFor";

/**
 * Verifies a real pending reader keeps a separate waiter from early adoption.
 *
 * 1. Publish a binary while the original reader and exact generation remain held.
 * 2. Observe the worker's real fence registration and unchanged return cell.
 * 3. Join the original reader, settle/release, and reuse the same binary bytes.
 *
 * @evidence contracts/testing.md#behavioral-verification A real Node filesystem reader and held source generation outlive binary publication. A separate worker executes the actual synchronous waiter; observed fence registration and a zero shared return cell prove it did not adopt pending bytes. Original child close precedes certified settlement and lock release, after which the worker acquires the key and reads the same binary marker.
 * @evidence contracts/testing.md#independent-expectations Literal original reader input and binary marker bytes establish preservation and reuse. Actual ChildProcess close supplies closure; actual observer publication supplies waiter admission, and no startup sleep is treated as either proof.
 * @evidence contracts/testing.md#distinguishing-cases Published-but-pending contrasts with the identical published bytes after original closure. Exact held generation and a separate worker distinguish ordinary same-key fanout from same-scope reentrancy or unrelated shared-Go admission.
 * @evidence contracts/testing.md#execution-ownership One source unit owns real temporary files, one original Node reader handle and one actual waiter worker. Process/worker errors remain failures independently of actual CLOSE/EXIT joins; cleanup attempts both joins and releases the held lease once. Unconfirmed closure retains inputs. The typed settlement boundary does not claim a Go compiler, installed SDK or platform supervisor receipt test.
 */
export async function test_sourcenativeretirement_pending_waiter_reuses_binary_after_actual_join(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-pending-waiter-"),
  );
  const cache = path.join(root, "cache");
  fs.mkdirSync(cache);
  const input = path.join(root, "input");
  fs.writeFileSync(input, "original reader input");
  const ready = path.join(root, "reader-ready");
  const binaryPath = path.join(cache, "plugin");
  const lockDir = `${cache}.lock`;
  const scope = SourceNativeRetirement.createScope("normal-original-producer");
  const lease = SourceNativeRetirement.run(scope, () =>
    acquirePluginBuildLock(lockDir),
  );
  assert.ok(lease);
  SourceNativeRetirement.run(scope, () =>
    SourceNativeRetirement.begin("normal-reader"),
  );
  const failures: unknown[] = [];
  const record = (error: unknown): void => {
    if (!failures.includes(error)) failures.push(error);
  };
  let child: ReturnType<typeof spawn>;
  try { child = spawn(
    process.execPath,
    [
      "-e",
      "const fs=require('node:fs');const [input,ready]=process.argv.slice(1);fs.readFileSync(input);fs.writeFileSync(ready,'ready');process.send({event:'ready',file:ready,pid:process.pid});setInterval(()=>fs.readFileSync(input),5);",
      input,
      ready,
    ],
    { stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true },
  ); } catch (error) {
    TestProject.retainTemporaryDirectory(root, "Reader admission did not return its original handle");
    throw error;
  }
  const readerReady = new Promise<void>((resolve, reject) => {
    child.once("message", (value) => {
      try {
        assert.deepEqual(value, { event: "ready", file: ready, pid: child.pid });
        resolve();
      } catch (error) { reject(error); }
    });
    child.once("error", reject);
    child.once("close", () => reject(new Error("reader closed before readiness")));
  });
  let childJoined = false;
  child.on("error", record);
  const childClosed = new Promise<void>((resolve) => {
    child.once("close", () => { childJoined = true; resolve(); });
  });
  let worker: Worker | undefined;
  let workerExit: Promise<number> | undefined;
  let workerJoined = false;
  let released = false;
  let releaseCompleted = false;
  const release = (): void => {
    if (released) return;
    SourceNativeRetirement.run(scope, () => {
      SourceNativeRetirement.settle("normal-reader", "joined");
      released = true;
      releasePluginBuildLock(lockDir, lease);
      releaseCompleted = true;
    });
  };
  const returned = new SharedArrayBuffer(4);
  const protocol = PluginBuildLockProtocol.pluginBuildLockProtocolDir(lockDir);
  try {
    await readerReady;
    assert.equal(fs.readFileSync(ready, "utf8"), "ready");
    fs.writeFileSync(binaryPath, "original published binary");
    worker = new Worker(
      `const {parentPort,workerData:d}=require('node:worker_threads');
      (async()=>{await import(d.loader);const {waitForPluginBinary:wait}=await import(d.waiter);const {acquirePluginBuildLock:acquire}=await import(d.acquire);const {releasePluginBuildLock:release}=await import(d.release);const {waitFor:observe}=await import(d.condition);const fs=require('node:fs');
      const result=wait(d.opts);Atomics.store(new Int32Array(d.returned),0,1);let lease;await observe(()=>Boolean(lease=acquire(d.opts.lockDir)),'actual waiter key release');try{parentPort.postMessage({result,bytes:fs.readFileSync(d.opts.binaryPath,'utf8')});}finally{release(d.opts.lockDir,lease);}
      })().catch(error=>{throw error});`,
      {
        eval: true,
        workerData: {
          returned,
          condition: pathToFileURL(path.resolve(import.meta.dirname,
            "../../../../utils/src/internal/waitFor.ts")).href,
          opts: {
            binaryPath,
            lockDir,
            lockInfo: {
              label: "plugin",
              pluginName: "normal-fanout",
              quiet: true,
            },
            // This is successful-publication coverage, not the separate timeout-refusal case.
            // The original Worker error/exit and parent release own completion.
            timeoutMs: Number.POSITIVE_INFINITY,
          },
          loader: pathToFileURL(
            path.resolve(
              import.meta.dirname,
              "../../../../../config/register-unit-loader.mjs",
            ),
          ).href,
          waiter: pathToFileURL(
            path.resolve(
              import.meta.dirname,
              "../../../../../packages/ttsc/src/plugin/internal/source/waitForPluginBinary.ts",
            ),
          ).href,
          acquire: pathToFileURL(
            path.resolve(
              import.meta.dirname,
              "../../../../../packages/ttsc/src/plugin/internal/source/acquirePluginBuildLock.ts",
            ),
          ).href,
          release: pathToFileURL(
            path.resolve(
              import.meta.dirname,
              "../../../../../packages/ttsc/src/plugin/internal/source/releasePluginBuildLock.ts",
            ),
          ).href,
        },
      },
    );
    let workerEnded = false;
    let workerFailure: { error: unknown } | undefined;
    workerExit = new Promise<number>((resolve) => {
      worker!.once("exit", (code) => {
        workerEnded = true;
        workerJoined = true;
        resolve(code);
      });
    });
    const answer = new Promise<unknown>((resolve, reject) => {
      worker!.once("message", resolve);
      worker!.once("error", reject);
      worker!.once("exit", () => reject(new Error("waiter exited before its answer")));
    });
    worker.once("error", (error) => { workerFailure = { error }; record(error); });
    void answer.catch(() => undefined);
    await waitFor(() => {
      const observers = path.join(protocol, "current",
        PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OBSERVERS_DIR);
      return fs.existsSync(observers) && fs.readdirSync(observers).length !== 0;
    }, "actual waiter fence", { check: () => {
      if (workerFailure !== undefined) throw workerFailure.error;
      assert.equal(workerEnded, false, "waiter closed before fence publication");
    } });
    assert.equal(Atomics.load(new Int32Array(returned), 0), 0);
    assert.equal(childJoined, false, "reader closed before pending observation");
    assert.equal(fs.readFileSync(input, "utf8"), "original reader input");
    assert.equal(child.kill(), true);
    await childClosed;
    release();
    assert.deepEqual(await answer, {
      result: { outcome: "published" },
      bytes: "original published binary",
    });
    assert.equal(await workerExit, 0);
    console.info(
      "native-retention normal-fanout",
      JSON.stringify({
        originalPid: child.pid,
        originalCloseJoined: childJoined,
        pendingWaiterReturned: false,
        waiterWorkerJoined: workerJoined,
        reusedBinaryBytes: "original published binary",
      }),
    );
  } catch (error) {
    record(error);
  } finally {
    if (worker !== undefined && !workerJoined) {
      try { await worker.terminate(); } catch (error) { record(error); }
      await workerExit;
    }
    if (!childJoined) {
      try { child.kill(); } catch (error) { record(error); }
      await childClosed;
    }
    if (childJoined) {
      try { release(); } catch (error) { record(error); }
    }
    if (!childJoined || !releaseCompleted || fs.existsSync(path.join(protocol, "current")) ||
        SourceNativeRetirement.isProtected(protocol))
      TestProject.retainTemporaryDirectory(
        root,
        "Original pending native reader closure was not confirmed",
      );
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "Pending waiter ownership assertions failed");
}
