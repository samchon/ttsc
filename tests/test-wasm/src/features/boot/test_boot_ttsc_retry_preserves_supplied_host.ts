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
