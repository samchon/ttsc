import { BootTtscWorkerTerminationError, bootTtsc } from "@ttsc/wasm";
import assert from "node:assert/strict";

import { withBootStubs } from "../../internal/bootHarness";

/**
 * Verifies a runtime that exits after `go.run` terminally poisons its API name.
 *
 * The old Go runtime cannot be stopped once invoked. Reusing its Worker would
 * expose a new readiness bridge that stale runtime work could invoke, so the
 * same API name must reject without executing another runtime. Pre-runtime
 * retry remains covered by the fetch and queue cases in the bounded boot test.
 *
 * 1. Let the first runtime exit without signaling readiness.
 * 2. Retry the same API name with the same and a different URL.
 * 3. Assert every call returns one terminal error and `go.run` ran only once.
 */
export const test_boot_ttsc_requires_worker_replacement_after_early_exit =
  async (): Promise<void> => {
    const apiName = "ttscRetryEarlyExit";
    const wasmUrl = "http://local/retry-early-exit.wasm";
    let attempt = 0;

    await withBootStubs(
      apiName,
      {
        onRun: () => {
          attempt += 1;
          return Promise.resolve();
        },
      },
      async () => {
        let terminal!: BootTtscWorkerTerminationError;
        await assert.rejects(
          bootTtsc({ apiName, wasmUrl }),
          (error: unknown) => {
            assert.ok(error instanceof BootTtscWorkerTerminationError);
            terminal = error;
            assert.match(error.message, /exited before signaling readiness/);
            return true;
          },
        );
        await assert.rejects(
          bootTtsc({ apiName, wasmUrl }),
          (error: unknown) => error === terminal,
        );
        await assert.rejects(
          bootTtsc({ apiName, wasmUrl: wasmUrl + "?replacement=1" }),
          (error: unknown) => error === terminal,
        );
        assert.equal(attempt, 1);
      },
    );
  };
