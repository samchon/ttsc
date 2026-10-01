import { TestValidator } from "@nestia/e2e";
import { BootTtscWorkerTerminationError, bootTtsc } from "@ttsc/wasm";

import { withBootStubs } from "../../internal/bootHarness";

/**
 * Verifies bootTtsc rejects with an actionable error when the Go runtime exits
 * before signaling readiness.
 *
 * This is the core RA-18 defect: `go.run` was started fire-and-forget and only
 * `Ready`/`Failed` were awaited, so a runtime that exited before either signal
 * (an early `host.Expose` panic that never reached the `Failed` bridge) left
 * the public boot Promise pending forever. Racing `go.run` settlement against
 * readiness makes an unsignaled early exit reject with a synthesized cause
 * instead of hanging.
 *
 * 1. Stub a fake runtime whose `go.run` resolves without calling Ready/Failed.
 * 2. Boot it.
 * 3. Assert the boot rejects and the message names the early exit before
 *    readiness.
 *
 * @evidence contracts/testing.md#behavioral-verification bootTtsc rejects an unsignaled fulfilled go.run with BootTtscWorkerTerminationError naming pre-readiness exit. A missing rejection or an unrelated error cannot satisfy the predicates.
 * @evidence contracts/testing.md#independent-expectations A runtime that exits before Ready cannot provide an API; the boot contract requires an actionable terminal failure. The independently literal message fragment and error class establish that outcome without reproducing the promise-race implementation.
 * @evidence contracts/testing.md#distinguishing-cases Immediate go.run fulfillment without either bridge is the negative readiness case. test_boot_ttsc_resolves_normal_host supplies Ready with a still-running runtime; explicit Failed is covered separately.
 * @evidence contracts/testing.md#execution-ownership test_boot_ttsc_rejects_before_readiness calls authored bootTtsc with withBootStubs.onRun returning Promise.resolve and owns both rejection predicates in the source-unit runner. Only environmental globals are doubled; no real runtime artifact executes.
 */
export const test_boot_ttsc_rejects_before_readiness =
  async (): Promise<void> => {
    const apiName = "ttscEarlyExit";
    let caught: Error | null = null;
    await withBootStubs(
      apiName,
      {
        onRun: () => Promise.resolve(),
      },
      async () => {
        try {
          await bootTtsc({ apiName, wasmUrl: "http://local/early-exit.wasm" });
        } catch (error) {
          caught = error as Error;
        }
      },
    );

    const rejection: unknown = caught;
    TestValidator.predicate(
      "boot rejected instead of hanging",
      rejection !== null,
    );
    TestValidator.predicate(
      "rejection names the pre-readiness exit",
      rejection instanceof BootTtscWorkerTerminationError &&
        /exited before signaling readiness/.test(rejection.message),
    );
  };
