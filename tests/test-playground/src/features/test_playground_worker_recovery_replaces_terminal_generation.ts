import { BootTtscWorkerTerminationError } from "@ttsc/wasm";
import assert from "node:assert/strict";

import { recoverTerminalCompilerWorker } from "../../../../packages/playground/lib/src/react/internal/recoverTerminalCompilerWorker.js";

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
  };
