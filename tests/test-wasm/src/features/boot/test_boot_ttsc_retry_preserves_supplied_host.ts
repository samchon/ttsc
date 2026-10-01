import { TestValidator } from "@nestia/e2e";
import { bootTtsc, createMemFS } from "@ttsc/wasm";

import { FAKE_API, withBootStubs } from "../../internal/bootHarness";

/**
 * Verifies the host-identity invariant also holds for an explicit
 * `options.host` reused across a failed attempt and a successful retry.
 *
 * RA-20 must not special-case default hosts: when the caller supplies one host
 * for both attempts, the failed attempt's global restore must leave that host's
 * `fs` reinstallable so the successful retry binds and returns the very same
 * host the runtime captured. Reusing one host across attempts is explicitly
 * supported and must stay safe.
 *
 * 1. Pass one `createMemFS()` host to both attempts; first fetch 503, second 200.
 * 2. The successful runtime records its captured `globalThis.fs`.
 * 3. Assert the returned host is the supplied host and its fs is the captured one.
 *
 * @evidence contracts/testing.md#behavioral-verification bootTtsc retries after HTTP 503 using the same explicit MemFS host and returns the host whose fs the successful runtime captured. Reference comparisons reject replacing a caller-owned host or retaining an unrelated filesystem.
 * @evidence contracts/testing.md#independent-expectations The caller supplies one createMemFS object for both calls, establishing the independent host identity. A 503 response must reject and a 200 response with Ready may resolve; capturedFs is an environmental observation, not a generated expected host.
 * @evidence contracts/testing.md#distinguishing-cases Pre-runtime failure and successful same-key retry use an explicit host. test_boot_ttsc_retry_returns_runtime_host owns default-host replacement and byte visibility; post-start retries are terminal in the early-exit test.
 * @evidence contracts/testing.md#execution-ownership test_boot_ttsc_retry_preserves_supplied_host calls bootTtsc twice through withBootStubs fetchStatuses [503,200] and compares the returned host and captured fs. createMemFS and the boot module run directly in Node without installed-consumer or Wasm preparation.
 */
export const test_boot_ttsc_retry_preserves_supplied_host =
  async (): Promise<void> => {
    const apiName = "ttscSuppliedHost";
    const wasmUrl = "http://local/supplied-host.wasm";
    const host = createMemFS();
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
          bootTtsc({ apiName, wasmUrl, host }),
        );
        return bootTtsc({ apiName, wasmUrl, host });
      },
    );

    TestValidator.predicate(
      "returned host is the supplied host",
      result.host === host,
    );
    TestValidator.predicate(
      "supplied host.fs is the runtime's captured filesystem",
      (host.fs as unknown) === capturedFs,
    );
  };
