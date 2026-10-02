import { TestValidator } from "@nestia/e2e";
import { BootTtscWorkerTerminationError, bootTtsc } from "@ttsc/wasm";

import { withBootStubs } from "../../internal/bootHarness";

/**
 * Verifies an explicit `Failed` signal rejects bootTtsc once with its original
 * cause, even when the runtime also exits afterward.
 *
 * A known host validation failure (e.g. a duplicate plugin name) invokes the
 * `Failed` bridge and then returns, so the Go runtime exits too. Both the
 * `Failed` rejection and the early-exit race branch settle; the boot must
 * reject with the real `Failed` cause rather than the generic early-exit
 * message, and the losing branch must not become an unhandled rejection.
 *
 * 1. Stub a runtime that fires `Failed` with a duplicate-plugin-name error then
 *    exits.
 * 2. Boot it and let the losing branch settle.
 * 3. Assert the terminal rejection preserves the duplicate-name cause and nothing
 *    leaked.
 *
 * @evidence contracts/testing.md#behavioral-verification bootTtsc preserves the explicit Failed error when the same runtime also exits. The terminal error type/code, original cause message and unhandledRejection count distinguish a generic early-exit substitution or an unowned losing promise.
 * @evidence contracts/testing.md#independent-expectations The supplied duplicate-plugin error is independently authored; Failed must keep that cause and the Worker-termination contract fixes the code. The literal zero rejection count observes the 20ms event-loop window only, not all possible future runtime activity.
 * @evidence contracts/testing.md#distinguishing-cases Failed followed immediately by a resolved go.run pins the race against generic early exit. test_boot_ttsc_rejects_before_readiness owns unsignaled runtime rejection, test_boot_ttsc_requires_worker_replacement_after_early_exit owns unsignaled fulfillment, and test_boot_ttsc_resolves_normal_host owns Ready success.
 * @evidence contracts/testing.md#execution-ownership test_boot_ttsc_preserves_explicit_failed_cause calls bootTtsc through withBootStubs and owns a scoped Node unhandledRejection listener removed in finally. The fake runtime emits Failed then resolves; no native Wasm build or product Worker is launched.
 */
export const test_boot_ttsc_preserves_explicit_failed_cause =
  async (): Promise<void> => {
    const apiName = "ttscFailedCause";
    const cause = 'host.Expose: duplicate plugin name "duplicate"';
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onRejection);
    let caught: Error | null = null;
    try {
      await withBootStubs(
        apiName,
        {
          onRun: (runtime) => {
            runtime.signalFailed(new Error(cause));
            return Promise.resolve();
          },
        },
        async () => {
          try {
            await bootTtsc({
              apiName,
              wasmUrl: "http://local/failed-cause.wasm",
            });
          } catch (error) {
            caught = error as Error;
          }
        },
      );

      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      const rejection: unknown = caught;
      TestValidator.predicate("boot rejected", rejection !== null);
      TestValidator.predicate(
        "post-run failure requires Worker replacement",
        rejection instanceof BootTtscWorkerTerminationError &&
          rejection.code === "TTSC_WASM_WORKER_TERMINATION_REQUIRED",
      );
      TestValidator.predicate(
        "original Failed cause is preserved",
        rejection instanceof BootTtscWorkerTerminationError &&
          rejection.cause instanceof Error &&
          rejection.cause.message === cause &&
          rejection.message.includes(cause),
      );
      TestValidator.equals(
        "no unhandled rejection from the losing branch",
        rejections.length,
        0,
      );
    } finally {
      process.off("unhandledRejection", onRejection);
    }
  };
