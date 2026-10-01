import assert from "node:assert/strict";
import path from "node:path";

import { watchBrokerSource } from "../../../../../packages/unplugin/src/core/transform/tracker/broker/watchBrokerSource";
import { runWatchBrokerProgram } from "../../internal/watch-broker/runWatchBrokerProgram";

/**
 * Verifies the watch broker forwards an event without a name to every
 * registration, whichever events it asked for (samchon/ttsc#1424).
 *
 * On Windows, libuv reports a watch whose `ReadDirectoryChangesW` buffer
 * overflowed as one change event with no filename: anything below the directory
 * may have changed. The broker used to forward a change event only to a
 * registration that asked for every event, so the rename-only candidate tracker
 * never heard an overflow, and a candidate that appeared during one was never
 * noticed.
 *
 * 1. Register a rename-only watch on the named entries of one directory.
 * 2. Fire a change of a named entry, a rename of an unnamed one, and a change
 *    without a name, and assert only the last is forwarded, unattributed.
 * 3. Add a second rename-only registration with different names and an all-events
 *    registration. Deliver each backend's unnamed event and require all three
 *    to forward it; contrast their named-change filtering and release them.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs watchBrokerSource through the in-process harness; contrasts named content, unrelated rename and unnamed change filtering, then requires all three registrations to forward their unnamed backend events while only the all-events registration forwards a named content event. Removal closes all three backend registrations.
 * @evidence contracts/testing.md#independent-expectations An unnamed event signifies potentially lost events irrespective of registration filters. The literal forwarded message distinguishes that safety requirement from both neighboring events that must be ignored.
 * @evidence contracts/testing.md#distinguishing-cases A rename-only registration drops named changes and unrelated renames, while an unnamed event reaches it. Two rename-only registrations with different name lists and an all-events registration all forward unnamed events; only the all-events registration forwards named changes. Fake closers verify release. Messages remain local arrays and no native overflow is provoked.
 * @evidence contracts/testing.md#execution-ownership Unit test: runs the real broker child program text (watchBrokerSource) in this process through runWatchBrokerProgram, which evaluates it with new Function and a fake process whose send method records messages and whose registered message handlers receive test input; node:fs.watch is a stub that captures the listener so the test can fire events by hand. No child process or real watcher is involved.
 */
export async function test_watch_broker_forwards_unattributed_events_to_every_registration(): Promise<void> {
  const directory = path.resolve("/project/src");
  const listeners: ((event: string, filename: string | null) => void)[] = [];
  let closed = 0;
  const broker = runWatchBrokerProgram(watchBrokerSource(), {
    "node:fs": {
      watch: (
        _directory: string,
        _options: object,
        listener: (event: string, filename: string | null) => void,
      ) => {
        listeners.push(listener);
        return { close: () => closed++, on: () => undefined };
      },
    },
  });
  broker.receive({
    allEvents: false,
    id: 1,
    locations: [{ directory, names: ["candidate.ts"] }],
    op: "add",
  });
  assert.deepEqual(broker.sent, [{ failed: false, id: 1, ready: true }]);

  const fire = listeners[0]!;
  fire("change", "candidate.ts");
  fire("rename", "unrelated.ts");
  fire("change", null);
  assert.deepEqual(broker.sent.slice(1), [
    { directory, eventType: "change", filename: null, id: 1 },
  ]);
  broker.receive({
    allEvents: false,
    id: 2,
    locations: [{ directory, names: ["another.ts"] }],
    op: "add",
  });
  broker.receive({
    allEvents: true,
    id: 3,
    locations: [{ directory }],
    op: "add",
  });
  assert.equal(listeners.length, 3);
  const start = broker.sent.length;
  for (const listener of listeners) {
    listener("change", "candidate.ts");
    listener("change", null);
  }
  assert.deepEqual(broker.sent.slice(start), [
    { directory, eventType: "change", filename: null, id: 1 },
    { directory, eventType: "change", filename: null, id: 2 },
    { directory, eventType: "change", filename: "candidate.ts", id: 3 },
    { directory, eventType: "change", filename: null, id: 3 },
  ]);
  for (const id of [1, 2, 3]) broker.receive({ id, op: "remove" });
  assert.equal(closed, 3);
}
