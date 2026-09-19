import assert from "node:assert/strict";
import path from "node:path";

import { watchBrokerSource } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/watchBrokerSource.mjs";
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
 */
export async function test_watch_broker_forwards_unattributed_events_to_every_registration(): Promise<void> {
  const directory = path.resolve("/project/src");
  const listeners: ((event: string, filename: string | null) => void)[] = [];
  const broker = runWatchBrokerProgram(watchBrokerSource(), {
    "node:fs": {
      watch: (
        _directory: string,
        _options: object,
        listener: (event: string, filename: string | null) => void,
      ) => {
        listeners.push(listener);
        return { close: () => undefined, on: () => undefined };
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
}
