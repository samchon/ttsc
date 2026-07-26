import {
  BootTtscWorkerTerminationError,
  DEFAULT_BOOT_TIMEOUT_MS,
  bootTtsc,
} from "@ttsc/wasm";
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
 * Verifies timeout and caller cancellation settle every asynchronous boot phase
 * and enforce the pre-runtime versus running-runtime retry boundary.
 *
 * A stalled fetch or Go runtime previously left the per-key single-flight and
 * per-api serialization chain pending forever. These cases use the same key for
 * each retry so a fresh URL cannot hide a poisoned entry.
 *
 * 1. Stall fetch, reach the finite deadline, and observe its forwarded signal.
 * 2. Assert phase-specific timeout ownership and readiness callback cleanup.
 * 3. Retry the same key and resolve normally.
 * 4. Join and cancel a shared same-key fetch, then retry it.
 * 5. Abort during Go readiness and prove queued and later boots are terminal.
 * 6. Fire stale Ready/Failed signals and prove no replacement bridge is exposed.
 * 7. Cancel a different-URL pre-runtime boot and retry after its predecessor.
 */
export const test_boot_ttsc_bounds_and_recovers_initialization =
  async (): Promise<void> => {
    assert.equal(DEFAULT_BOOT_TIMEOUT_MS, 60_000);
    assert.throws(
      () =>
        bootTtsc({
          apiName: "ttscInvalidDeadline",
          wasmUrl: "http://local/invalid-deadline.wasm",
          timeoutMs: 0,
        }),
      /timeoutMs must be a positive integer/,
    );

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
        const first = bootTtsc({
          apiName: fetchApiName,
          wasmUrl: fetchUrl,
          timeoutMs: 50,
        });
        await fetchStarted.promise;
        await assert.rejects(
          first,
          /timed out after 50ms while fetching .*bounded-fetch\.wasm/,
        );
        await fetchAborted.promise;
        assert.equal(Object.hasOwn(globalThis, fetchApiName + "Ready"), false);
        assert.equal(Object.hasOwn(globalThis, fetchApiName + "Failed"), false);

        const retried = await bootTtsc({
          apiName: fetchApiName,
          wasmUrl: fetchUrl,
          timeoutMs: 1_000,
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
          timeoutMs: 1_000,
        });
        await sharedFetchStarted.promise;
        const controller = new AbortController();
        const second = bootTtsc({
          apiName: sharedApiName,
          wasmUrl: sharedUrl,
          signal: controller.signal,
          timeoutMs: 1_000,
        });
        assert.equal(first, second);
        controller.abort(new Error("joined caller canceled"));
        await assert.rejects(first, /aborted while fetching .*bounded-shared/);
        await assert.rejects(second);

        const retried = await bootTtsc({
          apiName: sharedApiName,
          wasmUrl: sharedUrl,
          timeoutMs: 1_000,
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
          timeoutMs: 1_000,
        });
        await runStarted.promise;
        const queued = bootTtsc({
          apiName: readyApiName,
          wasmUrl: readyUrl + "?queued=1",
          timeoutMs: 1_000,
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
            timeoutMs: 1_000,
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
          timeoutMs: 1_000,
        });
        await queueFetchStarted.promise;
        await assert.rejects(
          bootTtsc({
            apiName: queueApiName,
            wasmUrl: secondQueueUrl,
            timeoutMs: 50,
          }),
          /timed out after 50ms while waiting for an earlier boot/,
        );

        firstQueueController.abort(new Error("release queue predecessor"));
        await assert.rejects(first, /aborted while fetching .*queue-first/);
        const retried = await bootTtsc({
          apiName: queueApiName,
          wasmUrl: secondQueueUrl,
          timeoutMs: 1_000,
        });
        assert.equal(retried.api as unknown, FAKE_API);
      },
    );
  };
