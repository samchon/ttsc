import { TestValidator } from "@nestia/e2e";
import { bootTtsc } from "@ttsc/wasm";

import { withBootStubs } from "../../internal/bootHarness";

/**
 * Verifies an explicit `Failed` signal rejects bootTtsc once with its original
 * cause, even when the runtime also exits afterward.
 *
 * A known host validation failure (e.g. a duplicate plugin name) invokes the
 * `Failed` bridge and then returns, so the Go runtime exits too. Both the
 * `Failed` rejection and the early-exit race branch settle; the boot must
 * reject exactly once with the real `Failed` cause — not the generic early-exit
 * message — and the losing branch must not become an unhandled rejection.
 *
 * 1. Stub a runtime that fires `Failed` with a duplicate-plugin-name error then
 *    exits.
 * 2. Boot it and let the losing branch settle.
 * 3. Assert the rejection preserves the duplicate-name cause and nothing leaked.
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
      TestValidator.predicate("boot rejected", caught !== null);
      TestValidator.equals(
        "original Failed cause is preserved",
        caught !== null ? (caught as Error).message : "",
        cause,
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
