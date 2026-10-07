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
 * @evidence contracts/testing.md#execution-ownership One source unit owns real temporary files, one original Node reader handle and one actual waiter worker. All process/worker exits are joined and observation intervals cleared; unconfirmed native closure retains inputs. The typed settlement boundary does not claim a Go compiler, installed SDK or platform supervisor receipt test.
 */
export async function test_sourcenativeretirement_pending_waiter_reuses_binary_after_actual_join(): Promise<void> {
  const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-pending-waiter-"));
  const cache = path.join(root, "cache");
  fs.mkdirSync(cache);
  const input = path.join(root, "input");
  fs.writeFileSync(input, "original reader input");
  const ready = path.join(root, "reader-ready");
  const binaryPath = path.join(cache, "plugin");
  const lockDir = `${cache}.lock`;
  const scope = SourceNativeRetirement.createScope("normal-original-producer");
  const lease = SourceNativeRetirement.run(scope, () => acquirePluginBuildLock(lockDir));
  assert.ok(lease);
  SourceNativeRetirement.run(scope, () => SourceNativeRetirement.begin("normal-reader"));
  const child = spawn(process.execPath, ["-e", "const fs=require('node:fs');const [input,ready]=process.argv.slice(1);fs.readFileSync(input);fs.writeFileSync(ready,'ready');setInterval(()=>fs.readFileSync(input),5);", input, ready], { stdio: "ignore", windowsHide: true });
  const childClosed = new Promise<void>((resolve, reject) => { child.once("error", reject); child.once("close", () => resolve()); });
  void childClosed.catch(() => undefined);
  let childJoined = false;
  let worker: Worker | undefined;
  let workerExit: Promise<number> | undefined;
  let workerJoined = false;
  let observation: ReturnType<typeof setInterval> | undefined;
  const returned = new SharedArrayBuffer(4);
  const protocol = PluginBuildLockProtocol.pluginBuildLockProtocolDir(lockDir);
  try {
    await new Promise<void>((resolve, reject) => {
      const deadline = performance.now() + 10_000;
      observation = setInterval(() => { if (fs.existsSync(ready)) resolve(); else if (performance.now() >= deadline) reject(new Error("reader readiness not observed")); }, 10);
    });
    clearInterval(observation);
    fs.writeFileSync(binaryPath, "original published binary");
    const observed = new Promise<void>((resolve, reject) => {
      const deadline = performance.now() + 10_000;
      observation = setInterval(() => {
        const observers = path.join(protocol, "current", PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OBSERVERS_DIR);
        if (fs.existsSync(observers) && fs.readdirSync(observers).length !== 0) resolve();
        else if (performance.now() >= deadline) reject(new Error("actual waiter fence not observed"));
      }, 10);
    });
    worker = new Worker(`const {parentPort,workerData:d}=require('node:worker_threads');
      (async()=>{await import(d.loader);const {waitForPluginBinary:wait}=await import(d.waiter);const {acquirePluginBuildLock:acquire}=await import(d.acquire);const {releasePluginBuildLock:release}=await import(d.release);const fs=require('node:fs');
      const result=wait(d.opts);Atomics.store(new Int32Array(d.returned),0,1);let lease;const deadline=performance.now()+10000;while(!(lease=acquire(d.opts.lockDir))){if(performance.now()>deadline)throw Error('key not released');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5);}try{parentPort.postMessage({result,bytes:fs.readFileSync(d.opts.binaryPath,'utf8')});}finally{release(d.opts.lockDir,lease);}
      })().catch(error=>{throw error});`, {
      eval: true,
      workerData: {
        returned,
        opts: { binaryPath, lockDir, lockInfo: { label: "plugin", pluginName: "normal-fanout", quiet: true }, timeoutMs: 60_000 },
        loader: pathToFileURL(path.resolve(import.meta.dirname, "../../../../../config/register-unit-loader.mjs")).href,
        waiter: pathToFileURL(path.resolve(import.meta.dirname, "../../../../../packages/ttsc/src/plugin/internal/source/waitForPluginBinary.ts")).href,
        acquire: pathToFileURL(path.resolve(import.meta.dirname, "../../../../../packages/ttsc/src/plugin/internal/source/acquirePluginBuildLock.ts")).href,
        release: pathToFileURL(path.resolve(import.meta.dirname, "../../../../../packages/ttsc/src/plugin/internal/source/releasePluginBuildLock.ts")).href,
      },
    });
    workerExit = new Promise<number>((resolve, reject) => { worker!.once("exit", resolve); worker!.once("error", reject); });
    const answer = new Promise<unknown>((resolve, reject) => { worker!.once("message", resolve); worker!.once("error", reject); });
    void workerExit.catch(() => undefined);
    void answer.catch(() => undefined);
    await observed;
    clearInterval(observation);
    assert.equal(Atomics.load(new Int32Array(returned), 0), 0);
    assert.equal(fs.readFileSync(input, "utf8"), "original reader input");
    assert.equal(child.kill(), true);
    await childClosed;
    childJoined = true;
    SourceNativeRetirement.run(scope, () => {
      SourceNativeRetirement.settle("normal-reader", "joined");
      releasePluginBuildLock(lockDir, lease);
    });
    assert.deepEqual(await answer, { result: { outcome: "published" }, bytes: "original published binary" });
    assert.equal(await workerExit, 0);
    workerJoined = true;
    console.info("native-retention normal-fanout", JSON.stringify({ originalPid: child.pid, originalCloseJoined: childJoined, pendingWaiterReturned: false, waiterWorkerJoined: workerJoined, reusedBinaryBytes: "original published binary" }));
  } finally {
    clearInterval(observation);
    if (worker !== undefined && !workerJoined) { await worker.terminate(); await workerExit?.catch(() => undefined); }
    if (!childJoined) { child.kill(); await childClosed; childJoined = true; }
    if (childJoined) SourceNativeRetirement.run(scope, () => { SourceNativeRetirement.settle("normal-reader", "joined"); releasePluginBuildLock(lockDir, lease); });
    else TestProject.retainTemporaryDirectory(root, "Original pending native reader closure was not confirmed");
  }
}
