import { TestValidator } from "@nestia/e2e";
import { bootTtsc } from "@ttsc/wasm";

import { FAKE_API, withBootStubs } from "../../internal/bootHarness";
import { openFd, readFdText } from "../../internal/callbackFs";

/**
 * Verifies that after a boot fails past global installation and a retry
 * succeeds, the returned host is the exact filesystem the Go runtime captured.
 *
 * This is the RA-20 defect: a failed attempt left its `globalThis.fs` installed,
 * so a retry (which only installs `fs` when absent) created a fresh host, saw
 * the stale global, and returned a host the runtime never used — files written
 * through it were invisible to the compiler. Restoring the failed attempt's own
 * globals lets the retry install and return the host its runtime binds.
 *
 * 1. First fetch returns 503 (fail after installing `fs`); second returns 200.
 * 2. The successful runtime records the `globalThis.fs` it captured at start.
 * 3. Assert the returned `host.fs` is that captured fs and a file written
 *    through the returned host is readable via that same fs.
 */
export const test_boot_ttsc_retry_returns_runtime_host =
  async (): Promise<void> => {
    const apiName = "ttscRetryHost";
    const wasmUrl = "http://local/retry-host.wasm";
    let capturedFs: unknown;

    const result = await withBootStubs(
      apiName,
      {
        fetchStatuses: [503, 200],
        onRun: (runtime) => {
          capturedFs = runtime.capturedFs;
          runtime.signalReady(FAKE_API);
          return new Promise<void>(() => {});
        },
      },
      async () => {
        await TestValidator.error("first attempt rejects on 503", () =>
          bootTtsc({ apiName, wasmUrl }),
        );
        return bootTtsc({ apiName, wasmUrl });
      },
    );

    TestValidator.predicate(
      "returned host.fs is the runtime's captured filesystem",
      (result.host.fs as unknown) === capturedFs,
    );

    // A file mounted through the returned host must be visible to the exact fs
    // the runtime reads through — the whole point of the identity invariant.
    result.host.writeFile("/project/main.ts", "export const x = 1;\n");
    const fd = await openFd(result.host.fs, "/project/main.ts", 0);
    TestValidator.equals(
      "runtime fs sees a file written through the returned host",
      await readFdText(result.host.fs, fd, 64),
      "export const x = 1;\n",
    );
  };
