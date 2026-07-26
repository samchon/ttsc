import { DEFAULT_BOOT_TIMEOUT_MS, bootTtsc } from "@ttsc/wasm";
import assert from "node:assert/strict";

import { FAKE_API, withBootStubs } from "../../internal/bootHarness";

function signal(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * Verifies timeout and caller cancellation settle every asynchronous boot phase
 * and release the shared cache and readiness bridge for a retry.
 *
 * A stalled fetch or Go runtime previously left the per-key single-flight and
 * per-api serialization chain pending forever. These cases use the same key for
 * each retry so a fresh URL cannot hide a poisoned entry.
 *
 * 1. Stall fetch, reach the finite deadline, and observe its forwarded signal.
 * 2. Assert phase-specific timeout ownership and readiness callback cleanup.
 * 3. Retry the same key and resolve normally.
 * 4. Join and cancel a shared same-key fetch, then retry it.
 * 5. Abort during Go readiness, verify the exact cause, then retry that key.
 * 6. Cancel a different-URL boot while queued and retry it after its predecessor.
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
    let run = 0;
    await withBootStubs(
      readyApiName,
      {
        onRun: async (runtime) => {
          if (run++ === 0) {
            runStarted.resolve();
            return new Promise<void>(() => undefined);
          }
          runtime.signalReady(FAKE_API);
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
        controller.abort(cause);
        await assert.rejects(first, (error) => {
          assert.match(
            (error as Error).message,
            /aborted while waiting for ttscBoundedReadiness readiness/,
          );
          assert.equal((error as Error & { cause?: unknown }).cause, cause);
          return true;
        });
        assert.equal(Object.hasOwn(globalThis, readyApiName + "Ready"), false);
        assert.equal(Object.hasOwn(globalThis, readyApiName + "Failed"), false);

        const retried = await bootTtsc({
          apiName: readyApiName,
          wasmUrl: readyUrl,
          timeoutMs: 1_000,
        });
        assert.equal(retried.api as unknown, FAKE_API);
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
