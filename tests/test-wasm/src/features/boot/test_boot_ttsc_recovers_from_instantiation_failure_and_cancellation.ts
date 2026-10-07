import { bootTtsc } from "@ttsc/wasm";
import assert from "node:assert/strict";

import { FAKE_API, withBootStubs } from "../../internal/bootHarness";

/**
 * Verifies streaming-instantiation failure and cancellation release the
 * pre-runtime boot so the same key can succeed on retry.
 *
 * Fetch recovery alone does not reach the later pre-runtime await. A cancelled
 * instantiation may finish after its caller leaves; that completion must not
 * start a runtime or recreate readiness callbacks.
 *
 * 1. Reject streaming instantiation with an authored error and retry the key.
 * 2. Hold another instantiation, cancel it, and complete the abandoned work.
 * 3. Verify no runtime or readiness bridge survives, then retry that same key.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual bootTtsc rejects a streaming-instantiation error unchanged and a cancelled streaming wait with the instantiation phase. Both leave no readiness slots, no installed fs and no Go run; late abandoned completion cannot start Go, and same-key retry resolves the authored API with one runtime call.
 * @evidence contracts/testing.md#independent-expectations Before go.run the boot contract permits recovery and requires removal of owned globals. Authored failure/cancellation objects, literal zero/one run counts and absent bridge slots are independent state oracles; FAKE_API is the supplied readiness value.
 * @evidence contracts/testing.md#distinguishing-cases Rejected instantiation and caller-cancelled pending instantiation retain distinct error/cause assertions. Late resolution after cancellation is the stale-work boundary; successful same-key retry is the positive control for both populations. Fetch and post-start aborts remain in the bounded-boot sibling.
 * @evidence contracts/testing.md#execution-ownership This discoverable source-unit entry calls bootTtsc in two sequential withBootStubs scopes, overriding only the already doubled streaming operation. Deferred latches own start/finish ordering and the harness restores globals and the original WebAssembly descriptor in finally; no real binary or Worker executes.
 */
export const test_boot_ttsc_recovers_from_instantiation_failure_and_cancellation =
  async (): Promise<void> => {
    for (const cancelled of [false, true]) {
      const apiName = cancelled
        ? "ttscInstantiationCanceled"
        : "ttscInstantiationFailed";
      const wasmUrl = `http://local/${apiName}.wasm`;
      let runs = 0;
      await withBootStubs(
        apiName,
        {
          onRun: async (runtime) => {
            runs++;
            runtime.signalReady(FAKE_API);
            return new Promise<void>(() => undefined);
          },
        },
        async () => {
          const instantiate = WebAssembly.instantiateStreaming;
          const cause = new Error(
            cancelled ? "navigation during compilation" : "invalid wasm bytes",
          );
          let started!: () => void;
          const start = new Promise<void>((resolve) => {
            started = resolve;
          });
          let complete!: (
            value: WebAssembly.WebAssemblyInstantiatedSource,
          ) => void;
          WebAssembly.instantiateStreaming = async () => {
            started();
            if (!cancelled) throw cause;
            return new Promise<WebAssembly.WebAssemblyInstantiatedSource>(
              (resolve) => {
                complete = resolve;
              },
            );
          };
          const controller = new AbortController();
          const first = bootTtsc({
            apiName,
            wasmUrl,
            signal: controller.signal,
          });
          await start;
          if (cancelled) controller.abort(cause);
          await assert.rejects(first, (error: unknown) => {
            if (!cancelled) return error === cause;
            assert.ok(error instanceof Error);
            assert.match(error.message, /aborted while instantiating/);
            assert.equal(error.cause, cause);
            return true;
          });
          const assertReleased = (): void => {
            assert.equal(runs, 0);
            assert.equal(Object.hasOwn(globalThis, apiName + "Ready"), false);
            assert.equal(Object.hasOwn(globalThis, apiName + "Failed"), false);
            assert.equal(Object.hasOwn(globalThis, "fs"), false);
          };
          assertReleased();
          if (cancelled) {
            complete({
              instance: {} as WebAssembly.Instance,
              module: {} as WebAssembly.Module,
            });
            await new Promise<void>((resolve) => setImmediate(resolve));
            assertReleased();
          }
          WebAssembly.instantiateStreaming = instantiate;
          const retried = await bootTtsc({ apiName, wasmUrl });
          assert.equal(retried.api as unknown, FAKE_API);
          assert.equal(runs, 1);
        },
      );
    }
  };
