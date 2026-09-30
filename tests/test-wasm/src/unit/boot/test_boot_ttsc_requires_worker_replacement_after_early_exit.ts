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
 *
 * @evidence contracts/testing.md#behavioral-verification bootTtsc keeps one terminal failure for a started runtime and refuses both same-URL and different-URL retries. Error identity and exactly one onRun call detect a replacement boot hidden behind cache-key changes.
 * @evidence contracts/testing.md#independent-expectations The one-runtime-per-Worker contract forbids restart after go.run. The captured first error is used as an identity oracle for later calls, while the independently literal invocation count of one proves no second runtime executes.
 * @evidence contracts/testing.md#distinguishing-cases Unsignaled initial exit, repeated original URL and a replacement query URL exercise terminal API ownership across different boot keys. Pre-runtime cancellation retries are covered by test_boot_ttsc_bounds_and_recovers_initialization.
 * @evidence contracts/testing.md#execution-ownership test_boot_ttsc_requires_worker_replacement_after_early_exit calls bootTtsc three times inside one withBootStubs scope and owns the counter and reference-equality rejection checks. Its controlled Go double runs in Node without instantiating a Wasm artifact or creating a Worker.
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
