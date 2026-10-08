import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

import { OwnedSynchronousProcess } from "../../../../../packages/ttsc/src/internal/OwnedSynchronousProcess";
import { GoBuildCacheCoordination } from "../../../../../packages/ttsc/src/plugin/internal/source/GoBuildCacheCoordination";
import { withGoBuildCacheLease } from "../../../../../packages/ttsc/src/plugin/internal/source/withGoBuildCacheLease";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies cancelled cache work still completes its own lease.
 *
 * Real workers and the permission-selected heartbeat child exercise closure,
 * rather than treating termination requests as successful joins.
 *
 * 1. Contrast admission, callback cancellation, callback failure and live results.
 * 2. Cancel a worker under maintenance contention and preserve the other owner.
 * 3. Deny Workers and join the actual child fallback before its success receipt.
 *
 * @evidence contracts/testing.md#behavioral-verification Pre-cancellation refuses unmanaged callbacks. Cancellation at actual managed callback completion removes its published record; normal results and callback errors preserve their outcomes. A worker blocked by a real maintenance record cancels after its lease directory is observed, removes its own records and preserves the independent maintenance owner bytes. A permission-restricted source Node process denies Workers and must join actual fallback child closure before printing its success receipt.
 * @evidence contracts/testing.md#independent-expectations A finished or cancelled payload must leave no active build record, while a separate maintenance owner remains active until its own finish. Literal return identity, original callback error identity and AbortError distinguish successful work, failure and cancellation.
 * @evidence contracts/testing.md#distinguishing-cases Unmanaged pre-abort and normal work, managed callback cancellation, managed callback failure, subsequent successful reuse and maintenance contention exercise both branches and scope restoration without a Go build. Actual Worker denial contrasts the child fallback with the normal worker path and catches unref-induced premature process exit during a pending join.
 * @evidence contracts/testing.md#execution-ownership One temporary root owns actual cache records, one source worker and a source Node process with its own heartbeat child. Polling actual lease-directory publication precedes cancellation, its observation interval is always cleared, worker exit is joined before maintenance finishes, and tracked heartbeat retirements are joined before returning. The fallback source process is joined with captured output and must itself complete both child close/control promises. No compiler, plugin descriptor or binary is built.
 */
export async function test_gobuildcachelease_cancellation_finishes_its_owned_record(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-cancellable-go-lease-");
  const cancel = new SharedArrayBuffer(4);
  const retirements = new Set<Promise<unknown>>();
  const scope = { cancel, retirements };
  const leases = path.join(
    root,
    GoBuildCacheCoordination.GO_BUILD_CACHE_LEASE_DIR,
  );
  const remaining = (): string[] =>
    fs.existsSync(leases) ? fs.readdirSync(leases) : [];
  let calls = 0;
  Atomics.store(new Int32Array(cancel), 0, 1);
  assert.throws(
    () =>
      OwnedSynchronousProcess.run(scope, () =>
        withGoBuildCacheLease(root, false, () => {
          calls += 1;
        }),
      ),
    { name: "AbortError" },
  );
  assert.equal(calls, 0);
  assert.equal(fs.existsSync(leases), false);
  const value = {};
  assert.equal(
    withGoBuildCacheLease(root, false, () => value),
    value,
  );
  Atomics.store(new Int32Array(cancel), 0, 0);
  try {
    assert.throws(
      () =>
        OwnedSynchronousProcess.run(scope, () =>
          withGoBuildCacheLease(root, true, () => {
            assert.equal(remaining().length, 1);
            Atomics.store(new Int32Array(cancel), 0, 1);
            return value;
          }),
        ),
      { name: "AbortError" },
    );
    assert.deepEqual(remaining(), []);
    Atomics.store(new Int32Array(cancel), 0, 0);
    const failure = new Error("authored callback failure");
    assert.throws(
      () =>
        OwnedSynchronousProcess.run(scope, () =>
          withGoBuildCacheLease(root, true, () => {
            throw failure;
          }),
        ),
      (error) => error === failure,
    );
    assert.deepEqual(remaining(), []);
    assert.equal(
      OwnedSynchronousProcess.run(scope, () =>
        withGoBuildCacheLease(root, true, () => value),
      ),
      value,
    );
    assert.deepEqual(remaining(), []);
    assert.ok(retirements.size > 0, "Actual heartbeat retirement was tracked");
  } finally {
    const settled = await Promise.allSettled(retirements);
    assert.deepEqual(
      settled.filter((result) => result.status === "rejected"),
      [],
    );
  }

  // A separate fresh root makes directory creation an actual entry observation.
  const contendedRoot = path.join(root, "contended");
  fs.mkdirSync(contendedRoot);
  const maintenance =
    GoBuildCacheCoordination.createGoBuildCacheCoordinationRecord(
      contendedRoot,
      GoBuildCacheCoordination.GO_BUILD_CACHE_MAINTENANCE_DIR,
    );
  const maintenanceBytes = fs.readFileSync(maintenance.file);
  const workerCancel = new SharedArrayBuffer(4);
  let observation: ReturnType<typeof setInterval> | undefined;
  let exited: Promise<number> | undefined;
  try {
    const entered = new Promise<void>((resolve, reject) => {
      observation = setInterval(() => {
        try {
          if (
            fs.existsSync(
              path.join(
                contendedRoot,
                GoBuildCacheCoordination.GO_BUILD_CACHE_LEASE_DIR,
              ),
            )
          )
            resolve();
        } catch (error) {
          reject(error);
        }
      }, 10);
    });
    const worker = new Worker(
      `const { parentPort, workerData } = require('node:worker_threads');
       (async () => {
         await import(workerData.loader);
         const { OwnedSynchronousProcess } = await import(workerData.owner);
         const { withGoBuildCacheLease } = await import(workerData.lease);
         try {
           OwnedSynchronousProcess.run({ cancel: workerData.cancel }, () => withGoBuildCacheLease(workerData.root, true, () => { throw new Error('Maintenance was bypassed'); }));
           parentPort.postMessage('returned');
         } catch (error) { parentPort.postMessage(error.name); }
       })().catch((error) => { throw error; });`,
      {
        eval: true,
        workerData: {
          root: contendedRoot,
          cancel: workerCancel,
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
          lease: pathToFileURL(
            path.resolve(
              import.meta.dirname,
              "../../../../../packages/ttsc/src/plugin/internal/source/withGoBuildCacheLease.ts",
            ),
          ).href,
        },
      },
    );
    const result = new Promise<unknown>((resolve, reject) => {
      worker.once("message", resolve);
      worker.once("error", reject);
    });
    exited = new Promise<number>((resolve) => worker.once("exit", resolve));
    await Promise.race([
      entered,
      result.then((value) => {
        throw new Error(`Lease ended before contention: ${String(value)}`);
      }),
    ]);
    Atomics.store(new Int32Array(workerCancel), 0, 1);
    Atomics.notify(new Int32Array(workerCancel), 0);
    assert.equal(await result, "AbortError");
    assert.equal(await exited, 0);
    assert.deepEqual(
      fs.readdirSync(
        path.join(
          contendedRoot,
          GoBuildCacheCoordination.GO_BUILD_CACHE_LEASE_DIR,
        ),
      ),
      [],
    );
    assert.deepEqual(fs.readFileSync(maintenance.file), maintenanceBytes);
  } finally {
    clearInterval(observation);
    Atomics.store(new Int32Array(workerCancel), 0, 1);
    Atomics.notify(new Int32Array(workerCancel), 0);
    if (exited !== undefined) await exited;
    maintenance.finish();
  }

  // Deny Workers through Node's actual permission boundary, without replacing
  // Worker or child_process globals. The nested source process must stay alive
  // until its independently tracked heartbeat child really closes.
  const repository = path.resolve(import.meta.dirname, "../../../../..");
  const fallbackRoot = path.join(root, "permission-fallback");
  const fallback = spawn(
    process.execPath,
    [
      "--permission",
      "--allow-fs-read=*",
      "--allow-fs-write=*",
      "--allow-child-process",
      "--import",
      pathToFileURL(path.join(repository, "config/register-unit-loader.mjs"))
        .href,
      "--input-type=module",
    ],
    { cwd: repository, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  );
  const output: Buffer[] = [];
  fallback.stdout.on("data", (chunk: Buffer) => output.push(chunk));
  fallback.stderr.on("data", (chunk: Buffer) => output.push(chunk));
  let launchFailure: Error | undefined;
  fallback.once("error", (error) => {
    launchFailure = error;
  });
  fallback.stdin.once("error", (error) => {
    launchFailure ??= error;
  });
  const closed = new Promise<number | null>((resolve) =>
    fallback.once("close", resolve),
  );
  fallback.stdin.end(`
    import assert from 'node:assert/strict';
    import { OwnedSynchronousProcess } from './packages/ttsc/src/internal/OwnedSynchronousProcess.ts';
    import { withGoBuildCacheLease } from './packages/ttsc/src/plugin/internal/source/withGoBuildCacheLease.ts';
    const retirements = new Set();
    assert.equal(OwnedSynchronousProcess.run(
      { cancel: new SharedArrayBuffer(4), retirements },
      () => withGoBuildCacheLease(${JSON.stringify(fallbackRoot)}, true, () => true),
    ), true);
    assert.ok(retirements.size >= 2);
    const settled = await Promise.allSettled(retirements);
    assert.deepEqual(settled.filter(result => result.status === 'rejected'), []);
    console.log('fallback heartbeat closure joined');
  `);
  const status = await closed;
  const transcript = Buffer.concat(output).toString("utf8");
  assert.equal(launchFailure, undefined, transcript);
  assert.equal(status, 0, transcript);
  assert.match(transcript, /fallback heartbeat closure joined/);
}
