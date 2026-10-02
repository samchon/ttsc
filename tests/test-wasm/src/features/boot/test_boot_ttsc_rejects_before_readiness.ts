import { TestValidator } from "@nestia/e2e";
import { BootTtscWorkerTerminationError, bootTtsc } from "@ttsc/wasm";

import { withBootStubs } from "../../internal/bootHarness";

/**
 * Verifies bootTtsc rejects with an actionable error when the Go runtime fails
 * before signaling readiness.
 *
 * The regression this guards: `go.run` was started fire-and-forget and only
 * `Ready`/`Failed` were awaited, so a runtime that exited before either signal
 * (an early `host.Expose` panic that never reached the `Failed` bridge) left
 * the public boot Promise pending forever. Racing `go.run` settlement against
 * readiness makes an unsignaled early exit reject with a synthesized cause
 * instead of hanging.
 *
 * 1. Stub a fake runtime whose `go.run` rejects without calling Ready/Failed.
 * 2. Boot it.
 * 3. Assert the terminal error names pre-readiness failure and the authored
 *    runtime rejection message.
 *
 * @evidence contracts/testing.md#behavioral-verification bootTtsc rejects an unsignaled rejected go.run with BootTtscWorkerTerminationError naming pre-readiness failure and the runtime's supplied message. A missing rejection, generic exit substitution or unrelated error cannot satisfy the predicates.
 * @evidence contracts/testing.md#independent-expectations A runtime that fails before Ready cannot provide an API; the boot contract requires an actionable terminal failure. The authored panic message and error class establish that outcome without reproducing the promise-race implementation.
 * @evidence contracts/testing.md#distinguishing-cases Immediate go.run rejection without either bridge is the failed-runtime case. test_boot_ttsc_requires_worker_replacement_after_early_exit owns fulfilled early exit, test_boot_ttsc_resolves_normal_host supplies Ready with a still-running runtime, and explicit Failed is covered separately.
 * @evidence contracts/testing.md#execution-ownership test_boot_ttsc_rejects_before_readiness calls authored bootTtsc with withBootStubs.onRun returning Promise.reject and owns both rejection predicates in the source-unit runner. Only environmental globals are doubled; no real runtime artifact executes.
 */
export const test_boot_ttsc_rejects_before_readiness =
  async (): Promise<void> => {
    const apiName = "ttscEarlyExit";
    const panic = "runtime panic before API publication";
    let caught: Error | null = null;
    await withBootStubs(
      apiName,
      {
        onRun: () => Promise.reject(new Error(panic)),
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
      "rejection names the pre-readiness failure and original panic",
      rejection instanceof BootTtscWorkerTerminationError &&
        /failed before signaling readiness/.test(rejection.message) &&
        rejection.message.includes(panic),
    );
  };
