import { TestValidator } from "@nestia/e2e";
import { bootTtsc } from "@ttsc/wasm";

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

    TestValidator.predicate(
      "boot rejected instead of hanging",
      caught !== null,
    );
    TestValidator.predicate(
      "rejection names the pre-readiness exit",
      caught !== null &&
        /exited before signaling readiness/.test((caught as Error).message),
    );
  };
