import assert from "node:assert/strict";
import path from "node:path";

import { watchBrokerSource } from "../../../../../packages/unplugin/src/core/transform/tracker/broker/watchBrokerSource";
import { runWatchBrokerProgram } from "../../internal/watch-broker/runWatchBrokerProgram";

/**
 * Verifies fs.watch drains wait through a queued callback on every host.
 *
 * A drain must yield through the poll turn and answer after its callbacks. This
 * test controls delivery at that boundary so a single-turn implementation fails
 * deterministically. It covers the broker's scheduling contract; the existing
 * real Windows scenario separately measures the kernel's completion ordering.
 *
 * 1. Open a recursive watch through the actual broker child program.
 * 2. In 200 rounds, request a drain and queue a backend event in the first turn.
 * 3. Assert no early reply, then exact event-before-reply order and one reply.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs watchBrokerSource in-process with controlled fs.watch callbacks; across 200 rounds asserts no inline/first-turn reply, exact event-before-drain messages and one backend close after removal.
 * @evidence contracts/testing.md#independent-expectations The drain scheduling contract requires queued backend callbacks before its acknowledgment. Authored Windows paths and literal message order are independent of broker scheduling; real kernel completion ordering is owned by the Windows boundary case.
 * @evidence contracts/testing.md#distinguishing-cases Owns a recursive watch, repeated uniquely named writes, first-turn callback delivery and teardown. The harness retains only arrays and scheduled immediates, with no child process or actual watcher.
 * @evidence contracts/testing.md#execution-ownership Unit entry test_watch_broker_defers_fs_watch_drains_through_queued_callbacks is discovered under src/unit/transform by TestExecutor. It invokes the owning operations in the test process against controlled fixture inputs; the assertions moved from features and source imports replace built package imports and this entry owns no dynamically registered cases.
 */
export async function test_watch_broker_defers_fs_watch_drains_through_queued_callbacks(): Promise<void> {
  let deliver: (event: string, filename: string) => void = () => {
    throw new Error("watch has not opened");
  };
  const opened: { directory: string; recursive: boolean }[] = [];
  let closed = 0;
  const broker = runWatchBrokerProgram(watchBrokerSource(), {
    "node:fs": {
      watch: (
        directory: string,
        options: { recursive: boolean },
        callback: typeof deliver,
      ) => {
        opened.push({ directory, recursive: options.recursive });
        deliver = callback;
        return {
          close: () => closed++,
          on: () => undefined,
        };
      },
    },
    "node:path": path.win32,
  });
  const directory = "C:\\project\\src";
  broker.receive({
    allEvents: true,
    id: 1,
    locations: [{ directory, recursive: true }],
    op: "add",
  });
  assert.deepEqual(opened, [{ directory, recursive: true }]);
  assert.deepEqual(broker.sent, [{ failed: false, id: 1, ready: true }]);
  for (let round = 0; round < 200; round++) {
    const start: number = broker.sent.length;
    const id = round + 100;
    const filename = `nested\\write-${round}.ts`;
    broker.receive({ id, op: "drain" });
    assert.equal(broker.sent.length, start, "drain never answers inline");
    await new Promise<void>((resolve, reject) =>
      setImmediate(() => {
        try {
          assert.equal(
            broker.sent.length,
            start,
            "the first turn must not answer before its backend callbacks",
          );
          deliver("change", filename);
          resolve();
        } catch (error) {
          reject(error);
        }
      }),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(broker.sent.slice(start), [
      { directory, eventType: "change", filename, id: 1 },
      { drained: true, id, unproven: [] },
    ]);
  }
  broker.receive({ id: 1, op: "remove" });
  assert.equal(closed, 1, "the registration releases its backend");
}
