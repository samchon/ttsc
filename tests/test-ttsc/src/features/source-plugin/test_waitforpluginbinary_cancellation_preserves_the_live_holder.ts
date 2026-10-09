import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

import { OwnedSynchronousProcess } from "../../../../../packages/ttsc/src/internal/OwnedSynchronousProcess";
import { PluginBuildLockProtocol } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildLockProtocol";
import { acquirePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/acquirePluginBuildLock";
import { releasePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/releasePluginBuildLock";
import { waitForPluginBinary } from "../../../../../packages/ttsc/src/plugin/internal/source/waitForPluginBinary";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies waiter cancellation preserves its live source-lock holder.
 *
 * Actual observer publication establishes that the worker entered contention;
 * cancellation must withdraw only that worker's admission.
 *
 * 1. Contrast pre-aborted, published and released waits.
 * 2. Cancel an observing worker and join its actual exit.
 * 3. Preserve holder bytes and exclusion until normal release and reacquisition.
 *
 * @evidence contracts/testing.md#behavioral-verification Pre-aborted scopes refuse both published and absent binaries. A worker calls the real synchronous waiter; observing its generation observer record precedes cancellation. The holder's exact owner bytes and lease remain intact, and normal released/published controls still succeed after the scope ends.
 * @evidence contracts/testing.md#independent-expectations An acquired live holder must remain exclusively owned until its own release; cancellation belongs to the waiter. AbortError is the scoped cancellation contract, distinct from a timeout or a published result.
 * @evidence contracts/testing.md#distinguishing-cases Pre-cancel, cancellation during a live wait, published success, released success and reacquisition distinguish admission, wakeup and scope restoration without guessing how long startup takes.
 * @evidence contracts/testing.md#execution-ownership One temporary root and one actual worker run source operations without Go or a compiler. The parent polls actual observer publication, cancels and joins the worker before releasing the real holder in finally. Its observation interval is cleared on every outcome. Unconfirmed worker closure retains the root instead of claiming cleanup.
 */
export async function test_waitforpluginbinary_cancellation_preserves_the_live_holder(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-cancellable-wait-");
  const opts = {
    binaryPath: path.join(root, "plugin"),
    lockDir: path.join(root, "entry.lock"),
    lockInfo: { label: "source plugin", pluginName: "waiter", quiet: true },
    timeoutMs: 600_000,
  };
  const aborted = new SharedArrayBuffer(4);
  Atomics.store(new Int32Array(aborted), 0, 1);
  for (const published of [false, true]) {
    if (published) fs.writeFileSync(opts.binaryPath, "published");
    assert.throws(
      () =>
        OwnedSynchronousProcess.run({ cancel: aborted }, () =>
          waitForPluginBinary(opts),
        ),
      { name: "AbortError" },
    );
  }
  assert.deepEqual(waitForPluginBinary(opts), { outcome: "published" });
  fs.rmSync(opts.binaryPath);
  assert.deepEqual(waitForPluginBinary(opts), { outcome: "released" });

  const lease = acquirePluginBuildLock(opts.lockDir);
  assert.ok(lease);
  const protocol = PluginBuildLockProtocol.pluginBuildLockProtocolDir(
    opts.lockDir,
  );
  const current = path.join(
    protocol,
    PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_CURRENT_DIR,
  );
  const ownerFile = path.join(
    current,
    PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OWNER_FILE,
  );
  const owner = fs.readFileSync(ownerFile);
  const cancel = new SharedArrayBuffer(4);
  let worker: Worker | undefined;
  let exited: Promise<number> | undefined;
  let joined = false;
  let observation: ReturnType<typeof setInterval> | undefined;
  try {
    // Only the worker's inspector registers an observer in this generation.
    const observed = new Promise<void>((resolve, reject) => {
      observation = setInterval(() => {
        try {
          const observers = path.join(
            current,
            PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OBSERVERS_DIR,
          );
          if (
            fs.existsSync(observers) &&
            fs.readdirSync(observers).length !== 0
          )
            resolve();
        } catch (error) {
          reject(error);
        }
      }, 10);
    });
    worker = new Worker(
      `const { parentPort, workerData } = require('node:worker_threads');
       (async () => {
         await import(workerData.loader);
         const { OwnedSynchronousProcess } = await import(workerData.owner);
         const { waitForPluginBinary } = await import(workerData.waiter);
         try {
           OwnedSynchronousProcess.run({ cancel: workerData.cancel }, () => waitForPluginBinary(workerData.opts));
           parentPort.postMessage('returned');
         } catch (error) { parentPort.postMessage(error.name); }
       })().catch((error) => { throw error; });`,
      {
        eval: true,
        workerData: {
          cancel,
          opts,
          loader: pathToFileURL(
            path.resolve(
              import.meta.dirname,
              "../../../../../config/register-unit-loader.mjs",
            ),
          ).href,
          owner: pathToFileURL(
            path.resolve(
              import.meta.dirname,
              "../../../../../packages/ttsc/src/internal/OwnedSynchronousProcess.ts",
            ),
          ).href,
          waiter: pathToFileURL(
            path.resolve(
              import.meta.dirname,
              "../../../../../packages/ttsc/src/plugin/internal/source/waitForPluginBinary.ts",
            ),
          ).href,
        },
      },
    );
    const result = new Promise<unknown>((resolve, reject) => {
      worker!.once("message", resolve);
      worker!.once("error", reject);
    });
    exited = new Promise<number>((resolve) => worker!.once("exit", resolve));
    await Promise.race([
      observed,
      result.then((value) => {
        throw new Error(`Waiter ended before registration: ${String(value)}`);
      }),
    ]);
    Atomics.store(new Int32Array(cancel), 0, 1);
    Atomics.notify(new Int32Array(cancel), 0);
    assert.equal(await result, "AbortError");
    assert.equal(await exited, 0);
    joined = true;
    assert.deepEqual(fs.readFileSync(ownerFile), owner);
    assert.equal(acquirePluginBuildLock(opts.lockDir), null);
  } finally {
    clearInterval(observation);
    Atomics.store(new Int32Array(cancel), 0, 1);
    Atomics.notify(new Int32Array(cancel), 0);
    if (exited !== undefined) {
      await exited;
      joined = true;
    }
    if (worker !== undefined && !joined)
      TestProject.retainTemporaryDirectory(
        root,
        "Source waiter worker closure was not confirmed",
      );
    releasePluginBuildLock(opts.lockDir, lease);
  }
  const next = acquirePluginBuildLock(opts.lockDir);
  assert.ok(next);
  releasePluginBuildLock(opts.lockDir, next);
}
