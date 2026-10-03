import { BootTtscWorkerTerminationError } from "@ttsc/wasm";
import assert from "node:assert/strict";

import { recoverTerminalCompilerWorker } from "../../../../packages/playground/src/react/internal/recoverTerminalCompilerWorker";

/**
 * Verifies playground Worker recovery: terminal boot errors replace generation.
 *
 * The shell receives compile and bundle errors as plain RPC result values. A
 * post-`go.run` marker must fence stale work, close the cached Worker, and only
 * then publish the failed state that exposes Retry. Ordinary compiler errors
 * must remain in the result pane without rebuilding the Worker.
 *
 * 1. Recover a plain terminal result and assert claim-reset-fail ordering.
 * 2. Recover a message-only tgrid error carrying the terminal marker.
 * 3. Consume an already-stale terminal result without touching the new Worker.
 * 4. Reject incidental marker text and ordinary compiler errors.
 * @evidence contracts/testing.md#behavioral-verification recoverTerminalCompilerWorker recognizes local/transported terminal identity, orders claim-reset-fail, preserves original error after reset rejection and consumes stale failures without resetting replacement state.
 * @evidence contracts/testing.md#independent-expectations Independent callback order arrays and error object identities pin recovery ownership; literal malformed/incidental markers and TS2322 are ordinary-error controls rather than expected classifications copied from the helper.
 * @evidence contracts/testing.md#distinguishing-cases Plain terminal record, framed message, refused stale claim, throwing reset, incidental middle marker, unframed string and ordinary compiler error preserve distinct positive/failure/negative outcomes.
 * @evidence contracts/testing.md#execution-ownership This entry owns recovery callback doubles and invokes the actual classifier/coordinator in the source-unit batch; it simulates disposal ordering without starting or replacing an actual Worker.
 */
export const test_playground_worker_recovery_replaces_terminal_generation =
  async (): Promise<void> => {
    const order: string[] = [];
    const failures: unknown[] = [];
    const terminal = {
      code: BootTtscWorkerTerminationError.CODE,
      message: "runtime started before readiness",
      name: "BootTtscWorkerTerminationError",
    };
    const recovery = {
      claim: () => {
        order.push("claim");
        return true;
      },
      reset: async () => {
        order.push("reset");
      },
      fail: (error: unknown) => {
        order.push("fail");
        failures.push(error);
      },
    };

    assert.equal(await recoverTerminalCompilerWorker(terminal, recovery), true);
    assert.deepEqual(order, ["claim", "reset", "fail"]);
    assert.deepEqual(failures, [terminal]);

    order.length = 0;
    const transported = new Error(
      `[${BootTtscWorkerTerminationError.CODE}] transported by tgrid`,
    );
    assert.equal(
      await recoverTerminalCompilerWorker(transported, recovery),
      true,
    );
    assert.deepEqual(order, ["claim", "reset", "fail"]);
    assert.equal(failures[1], transported);

    order.length = 0;
    assert.equal(
      await recoverTerminalCompilerWorker(terminal, {
        ...recovery,
        claim: () => {
          order.push("claim");
          return false;
        },
      }),
      true,
    );
    assert.deepEqual(order, ["claim"]);
    assert.equal(failures.length, 2);

    order.length = 0;
    assert.equal(
      await recoverTerminalCompilerWorker(
        new Error(
          `ordinary failure mentioned ${BootTtscWorkerTerminationError.CODE} in the middle`,
        ),
        recovery,
      ),
      false,
    );
    assert.deepEqual(order, []);

    assert.equal(
      await recoverTerminalCompilerWorker(
        `[${BootTtscWorkerTerminationError.CODE}]transport without a framed separator`,
        recovery,
      ),
      false,
    );
    assert.deepEqual(order, []);

    assert.equal(
      await recoverTerminalCompilerWorker(
        { code: "TS2322", message: "ordinary compile failure" },
        recovery,
      ),
      false,
    );
    assert.deepEqual(order, []);
    assert.equal(failures.length, 2);
    const resetError = new Error("controlled disposal failure");
    await assert.rejects(
      recoverTerminalCompilerWorker(terminal, {
        ...recovery,
        reset: async () => {
          await recovery.reset();
          throw resetError;
        },
      }),
      (error) => error === resetError,
    );
    assert.deepEqual(order, ["claim", "reset", "fail"]);
    assert.equal(failures[2], terminal, "failed disposal must still publish the original terminal failure");
    assert.equal(failures.length, 3);
  };
