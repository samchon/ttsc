import { BootTtscWorkerTerminationError, bootTtsc } from "@ttsc/wasm";
import assert from "node:assert/strict";

import {
  FAKE_API,
  type IFakeRuntime,
  withBootStubs,
} from "../../internal/bootHarness";

function signal(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * Verifies caller cancellation settles fetch, queue and readiness waits and
 * enforces the pre-runtime versus running-runtime retry boundary.
 *
 * A stalled fetch or Go runtime previously left the per-key single-flight and
 * per-api serialization chain pending forever. These cases use the same key for
 * each retry so a fresh URL cannot hide a poisoned entry.
 *
 * There is no boot deadline to exercise. How long a fetch and instantiation
 * take belongs to the network and the machine, so `signal` is the only way a
 * boot ends early, which makes it the thing that must release the cache
 * entry.
 *
 * 1. Stall fetch, abort it, observe the forwarded signal, assert phase-specific
 *    abort ownership and readiness callback cleanup, then retry the same key and
 *    resolve normally.
 * 2. Join and cancel a shared same-key fetch and retry it, and cancel a
 *    different-URL pre-runtime boot and retry after its predecessor.
 * 3. Abort during Go readiness and prove queued and later boots are terminal.
 * 4. Fire stale Ready and Failed signals and prove no replacement bridge is
 *    exposed.
 *
 * @evidence contracts/testing.md#behavioral-verification bootTtsc releases canceled pre-runtime cache and queue entries, forwards fetch cancellation, and terminally rejects a started runtime rather than exposing a replacement bridge. Exact promise identity, cause, callback absence and run count detect poisoned retries or stale readiness.
 * @evidence contracts/testing.md#independent-expectations The caller cancellation contract permits retry only before go.run; after it starts the Worker must be replaced. Authored cause objects, expected error code, one runtime invocation and absent Ready/Failed slots are independent state oracles, not results copied from bootTtsc.
 * @evidence contracts/testing.md#distinguishing-cases Stalled fetch, same-key joining, different-URL queued cancellation, running-runtime abort and late Ready/Failed callbacks retain their separate failure populations. Successful same-key retries provide the pre-runtime positive controls.
 * @evidence contracts/testing.md#execution-ownership test_boot_ttsc_bounds_and_recovers_initialization uses signal latches and withBootStubs to call authored bootTtsc serially in Node. Its four named API populations own every abort/retry assertion; the controlled fetch/Go doubles require neither a Wasm artifact nor a Worker.
 */
export const test_boot_ttsc_bounds_and_recovers_initialization =
  async (): Promise<void> => {
    const fetchApiName = "ttscBoundedFetch";
    const fetchUrl = "http://local/bounded-fetch.wasm";
    const fetchStarted = signal();
    const fetchAborted = signal();

    await withBootStubs(
      fetchApiName,
      {
        onFetch: async (_url, fetchSignal, call) => {
          if (call !== 0) return { ok: true, status: 200 };
          fetchStarted.resolve();
          fetchSignal?.addEventListener("abort", fetchAborted.resolve, {
            once: true,
          });
          return new Promise(() => undefined);
        },
        onRun: async (runtime) => {
          runtime.signalReady(FAKE_API);
          return new Promise<void>(() => undefined);
        },
      },
      async () => {
        const fetchController = new AbortController();
        const first = bootTtsc({
          apiName: fetchApiName,
          wasmUrl: fetchUrl,
          signal: fetchController.signal,
        });
        await fetchStarted.promise;
        fetchController.abort(new Error("page navigated away"));
        await assert.rejects(
          first,
          /aborted while fetching .*bounded-fetch\.wasm/,
        );
        await fetchAborted.promise;
        assert.equal(Object.hasOwn(globalThis, fetchApiName + "Ready"), false);
        assert.equal(Object.hasOwn(globalThis, fetchApiName + "Failed"), false);

        const retried = await bootTtsc({
          apiName: fetchApiName,
          wasmUrl: fetchUrl,
        });
        assert.equal(retried.api as unknown, FAKE_API);
      },
    );

    const sharedApiName = "ttscBoundedShared";
    const sharedUrl = "http://local/bounded-shared.wasm";
    const sharedFetchStarted = signal();
    await withBootStubs(
      sharedApiName,
      {
        onFetch: async (_url, _fetchSignal, call) => {
          if (call === 0) {
            sharedFetchStarted.resolve();
            return new Promise(() => undefined);
          }
          return { ok: true, status: 200 };
        },
        onRun: async (runtime) => {
          runtime.signalReady(FAKE_API);
          return new Promise<void>(() => undefined);
        },
      },
      async () => {
        const first = bootTtsc({
          apiName: sharedApiName,
          wasmUrl: sharedUrl,
        });
        await sharedFetchStarted.promise;
        const controller = new AbortController();
        const second = bootTtsc({
          apiName: sharedApiName,
          wasmUrl: sharedUrl,
          signal: controller.signal,
        });
        assert.equal(first, second);
        controller.abort(new Error("joined caller canceled"));
        await assert.rejects(first, /aborted while fetching .*bounded-shared/);
        await assert.rejects(second);

        const retried = await bootTtsc({
          apiName: sharedApiName,
          wasmUrl: sharedUrl,
        });
        assert.equal(retried.api as unknown, FAKE_API);
      },
    );

    const readyApiName = "ttscBoundedReadiness";
    const readyUrl = "http://local/bounded-readiness.wasm";
    const runStarted = signal();
    let staleRuntime: IFakeRuntime | undefined;
    let run = 0;
    await withBootStubs(
      readyApiName,
      {
        onRun: async (runtime) => {
          run++;
          staleRuntime = runtime;
          runStarted.resolve();
          return new Promise<void>(() => undefined);
        },
      },
      async () => {
        const controller = new AbortController();
        const cause = new Error("source was superseded");
        const first = bootTtsc({
          apiName: readyApiName,
          wasmUrl: readyUrl,
          signal: controller.signal,
        });
        await runStarted.promise;
        const queued = bootTtsc({
          apiName: readyApiName,
          wasmUrl: readyUrl + "?queued=1",
        });
        controller.abort(cause);
        let terminal!: BootTtscWorkerTerminationError;
        await assert.rejects(first, (error: unknown) => {
          assert.ok(error instanceof BootTtscWorkerTerminationError);
          terminal = error;
          assert.match(
            error.message,
            /aborted while waiting for ttscBoundedReadiness readiness/,
          );
          assert.equal(
            (
              error.cause as Error & {
                cause?: unknown;
              }
            ).cause,
            cause,
          );
          assert.equal(error.code, "TTSC_WASM_WORKER_TERMINATION_REQUIRED");
          assert.match(error.message, /terminate and replace this Worker/);
          return true;
        });
        await assert.rejects(queued, (error: unknown) => error === terminal);
        assert.equal(Object.hasOwn(globalThis, readyApiName + "Ready"), false);
        assert.equal(Object.hasOwn(globalThis, readyApiName + "Failed"), false);

        await assert.rejects(
          bootTtsc({
            apiName: readyApiName,
            wasmUrl: readyUrl,
          }),
          (error: unknown) => error === terminal,
        );
        staleRuntime!.signalReady({ version: "old-stale-api" });
        staleRuntime!.signalFailed(new Error("late stale failure"));
        await Promise.resolve();
        assert.equal(run, 1);
        assert.equal(Object.hasOwn(globalThis, readyApiName + "Ready"), false);
        assert.equal(Object.hasOwn(globalThis, readyApiName + "Failed"), false);
      },
    );

    const queueApiName = "ttscBoundedQueue";
    const firstQueueUrl = "http://local/queue-first.wasm";
    const secondQueueUrl = "http://local/queue-second.wasm";
    const queueFetchStarted = signal();
    const firstQueueController = new AbortController();
    await withBootStubs(
      queueApiName,
      {
        onFetch: async (_url, _fetchSignal, call) => {
          if (call === 0) {
            queueFetchStarted.resolve();
            return new Promise(() => undefined);
          }
          return { ok: true, status: 200 };
        },
        onRun: async (runtime) => {
          runtime.signalReady(FAKE_API);
          return new Promise<void>(() => undefined);
        },
      },
      async () => {
        const first = bootTtsc({
          apiName: queueApiName,
          wasmUrl: firstQueueUrl,
          signal: firstQueueController.signal,
        });
        await queueFetchStarted.promise;
        const queuedController = new AbortController();
        const queued = bootTtsc({
          apiName: queueApiName,
          wasmUrl: secondQueueUrl,
          signal: queuedController.signal,
        });
        queuedController.abort(new Error("caller stopped queueing"));
        await assert.rejects(
          queued,
          /aborted while waiting for an earlier boot/,
        );

        firstQueueController.abort(new Error("release queue predecessor"));
        await assert.rejects(first, /aborted while fetching .*queue-first/);
        const retried = await bootTtsc({
          apiName: queueApiName,
          wasmUrl: secondQueueUrl,
        });
        assert.equal(retried.api as unknown, FAKE_API);
      },
    );
  };
