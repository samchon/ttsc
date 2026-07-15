import { TestValidator } from "@nestia/e2e";
import { bootTtsc } from "@ttsc/wasm";

import { FAKE_API, withBootStubs } from "../../internal/bootHarness";

/**
 * Verifies a boot that rejects before readiness releases its in-flight entry so
 * a later boot for the same key can run and resolve.
 *
 * RA-18 requires that failure settlement also frees the per-key single-flight
 * cache and the per-apiName serialization chain; otherwise a retry would be
 * stuck behind the rejected promise. Using one `(apiName, wasmUrl)` key for
 * both attempts proves the eviction path, not just a fresh-key boot.
 *
 * 1. First attempt's runtime exits before readiness; second attempt signals ready.
 * 2. Boot the same key twice in sequence.
 * 3. Assert the first rejects and the second resolves with the api.
 */
export const test_boot_ttsc_retries_after_early_exit =
  async (): Promise<void> => {
    const apiName = "ttscRetryEarlyExit";
    const wasmUrl = "http://local/retry-early-exit.wasm";
    let attempt = 0;

    const result = await withBootStubs(
      apiName,
      {
        onRun: (runtime) => {
          attempt += 1;
          if (attempt === 1) return Promise.resolve();
          runtime.signalReady(FAKE_API);
          return new Promise<void>(() => {});
        },
      },
      async () => {
        await TestValidator.error("first attempt rejects", () =>
          bootTtsc({ apiName, wasmUrl }),
        );
        return bootTtsc({ apiName, wasmUrl });
      },
    );

    TestValidator.predicate(
      "retry resolved after the in-flight entry was released",
      (result.api as unknown) === FAKE_API,
    );
  };
