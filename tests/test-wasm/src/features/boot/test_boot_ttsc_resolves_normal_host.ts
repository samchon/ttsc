import { TestValidator } from "@nestia/e2e";
import { bootTtsc } from "@ttsc/wasm";

import { FAKE_API, withBootStubs } from "../../internal/bootHarness";

/**
 * Verifies bootTtsc resolves when the host signals readiness and its runtime
 * keeps running, with no unhandled rejection.
 *
 * This is the positive baseline the early-exit rejection cases are twinned
 * against: a normal Go host fires `Ready` and then keeps `go.run` pending
 * forever. The boot must resolve on `Ready`, return the exact host it installed,
 * and the never-settling `go.run` branch that lost the readiness race must not
 * surface as an unhandled rejection.
 *
 * 1. Stub a fake runtime that signals ready then returns a never-settling
 *    promise.
 * 2. Boot it and let a few event-loop turns pass.
 * 3. Assert the api and host came back and no unhandled rejection fired.
 */
export const test_boot_ttsc_resolves_normal_host = async (): Promise<void> => {
  const apiName = "ttscNormalHost";
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown): void => {
    rejections.push(reason);
  };
  process.on("unhandledRejection", onRejection);
  try {
    const result = await withBootStubs(
      apiName,
      {
        onRun: (runtime) => {
          runtime.signalReady(FAKE_API);
          return new Promise<void>(() => {});
        },
      },
      () => bootTtsc({ apiName, wasmUrl: "http://local/normal-host.wasm" }),
    );

    TestValidator.predicate(
      "api bound to the runtime global",
      (result.api as unknown) === FAKE_API,
    );
    TestValidator.predicate(
      "host returned with an fs shim",
      typeof result.host.fs === "object" && result.host.fs !== null,
    );

    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    TestValidator.equals(
      "the losing go.run branch stays silent",
      rejections.length,
      0,
    );
  } finally {
    process.off("unhandledRejection", onRejection);
  }
};
