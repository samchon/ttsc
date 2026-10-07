import assert from "node:assert/strict";
import path from "node:path";

import { watchBrokerSource } from "../../../../../packages/unplugin/src/core/transform/tracker/broker/watchBrokerSource";
import { runWatchBrokerProgram } from "../../internal/watch-broker/runWatchBrokerProgram";

/**
 * Verifies authored macOS stream names reach their native validation owner
 * without a basename prefilter certifying that alternate names are unrelated.
 *
 * This supplies FSEvents callbacks; it does not reproduce a native macOS alias
 * or prove which spelling an actual mounted filesystem will report.
 *
 * 1. Instantiate the real child program with a coherent Darwin/POSIX view.
 * 2. Supply alternate ASCII names in both directions and ordinary content.
 * 3. Require literal parent messages, preserve rename-only filtering and stop each
 *    stream once when its registration retires.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual watchBrokerSource FSEvents stream placement and subscriber delivery must forward supplied native alternate names to the parent. Exact messages retain id, directory, kind and raw filename; a rename-only subscription still excludes content events.
 * @evidence contracts/testing.md#independent-expectations Authored callback paths and CoreServices modified/created flag values determine literal messages. The stream supplies no alias-free basename capability, so native identity/uncertainty belongs to the parent rather than string equality. Actual macOS alias occurrence and native binding transport are outside this oracle.
 * @evidence contracts/testing.md#distinguishing-cases Long requested name with short event and the inverse contrast with exact-name content delivery; a separate rename-only registration excludes that content but receives rename. Literal stop counts verify independent retirement.
 * @evidence contracts/testing.md#execution-ownership One source entry evaluates the actual broker program through its existing module table with supplied fsevents.watch and native realpath answers. A synchronous controlled platform descriptor is restored immediately after fakeProcess construction in finally; explicit path.posix and /tmp keep the child view coherent. No child process, native FSEventStream or real macOS host runs.
 */
export function test_watch_broker_preserves_authored_macos_alternate_names(): void {
  const streams: {
    callback: (file: string, flags: number) => void;
    stopped: number;
  }[] = [];
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
  assert.ok(descriptor);
  let broker: ReturnType<typeof runWatchBrokerProgram>;
  try {
    Object.defineProperty(process, "platform", {
      ...descriptor,
      value: "darwin",
    });
    broker = runWatchBrokerProgram(
      watchBrokerSource("/authored/fsevents"),
      {
        "node:path": path.posix,
        "node:fs": { realpathSync: { native: (file: string) => file } },
        "/authored/fsevents": {
          watch: (
            root: string,
            callback: (file: string, flags: number) => void,
          ) => {
            assert.equal(root, "/project");
            const stream = { callback, stopped: 0 };
            streams.push(stream);
            return () => {
              ++stream.stopped;
            };
          },
        },
      },
      "/tmp",
    );
  } finally {
    Object.defineProperty(process, "platform", descriptor);
  }
  try {
    for (const [id, name, allEvents] of [
      [1, "LongConfig.config", true],
      [2, "LONGCO~1.CON", true],
      [3, "LongConfig.config", false],
    ] as const) {
      broker.receive({
        op: "add",
        id,
        allEvents,
        locations: [{ directory: "/project", names: [name] }],
      });
    }
    assert.deepEqual(
      broker.sent,
      [1, 2, 3].map((id) => ({ failed: false, id, ready: true })),
    );
    const CREATED = 0x100;
    const MODIFIED = 0x1000;
    streams[0]!.callback("/project/LONGCO~1.CON", CREATED);
    streams[1]!.callback("/project/LongConfig.config", CREATED);
    streams[0]!.callback("/project/LongConfig.config", MODIFIED);
    streams[2]!.callback("/project/LongConfig.config", MODIFIED);
    streams[2]!.callback("/project/LONGCO~1.CON", CREATED);
    assert.deepEqual(broker.sent.slice(3), [
      {
        directory: "/project",
        eventType: "rename",
        filename: "LONGCO~1.CON",
        id: 1,
      },
      {
        directory: "/project",
        eventType: "rename",
        filename: "LongConfig.config",
        id: 2,
      },
      {
        directory: "/project",
        eventType: "change",
        filename: "LongConfig.config",
        id: 1,
      },
      {
        directory: "/project",
        eventType: "rename",
        filename: "LONGCO~1.CON",
        id: 3,
      },
    ]);
  } finally {
    for (const id of [1, 2, 3]) broker.receive({ op: "remove", id });
  }
  assert.deepEqual(
    streams.map((stream) => stream.stopped),
    [1, 1, 1],
  );
}
