import assert from "node:assert/strict";

import { watchBrokerSource } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/watchBrokerSource.mjs";
import { runWatchBrokerProgram } from "../../internal/watch-broker/runWatchBrokerProgram";

/**
 * Verifies the watch broker's macOS backend reports a dropped-events notice as
 * a gap, and trusts no macOS watch without the `fsevents` binding
 * (samchon/ttsc#1425).
 *
 * FSEvents marks the event after a drop by the kernel or the client with
 * `MustScanSubDirs` and `KernelDropped` or `UserDropped`. libuv discards every
 * event with such a flag, so a macOS watch opened through `fs.watch` lost
 * events without notice, and the adapter read that silence as proof its inputs
 * were unchanged. The broker now watches through the binding, which passes
 * every flag through.
 *
 * 1. Load a stand-in binding, register a directory recursively and not, and assert
 *    each is ready at once on its own stream, opened on the directory's real
 *    path.
 * 2. Fire an edit, a creation, a nested removal, the root's own event, a drop, a
 *    changed root, and a path outside the stream, and assert each registration
 *    receives what libuv would report, a nested path only when recursive, and a
 *    gap for the drop, the changed root, and the unplaceable path.
 * 3. Remove a registration and assert its stream stops.
 * 4. Assert a registration is failed at once when the binding is absent or cannot
 *    be loaded.
 */
export async function test_watch_broker_reports_a_macos_drop_as_a_gap(): Promise<void> {
  const streams: {
    handler: (file: string, flags: number, id: number) => void;
    root: string;
    stopped: boolean;
  }[] = [];
  const binding = {
    watch: (
      root: string,
      handler: (file: string, flags: number, id: number) => void,
    ) => {
      const stream = { handler, root, stopped: false };
      streams.push(stream);
      return () => {
        stream.stopped = true;
        return Promise.resolve();
      };
    },
  };
  const linked = "/link/project";
  const broker = runWatchBrokerProgram(watchBrokerSource("/fake/fsevents.js"), {
    "/fake/fsevents.js": binding,
    "node:fs": {
      realpathSync: {
        native: (file: string) => (file === linked ? "/real/project" : file),
      },
    },
  });
  broker.receive({
    allEvents: true,
    id: 1,
    locations: [{ directory: linked, recursive: true }],
    op: "add",
  });
  broker.receive({
    allEvents: true,
    id: 2,
    locations: [{ directory: linked }],
    op: "add",
  });
  assert.deepEqual(broker.sent.slice(), [
    { failed: false, id: 1, ready: true },
    { failed: false, id: 2, ready: true },
  ]);
  assert.deepEqual(
    streams.map((stream) => stream.root),
    ["/real/project", "/real/project"],
  );

  const ITEM_CREATED = 0x100;
  const ITEM_REMOVED = 0x200;
  const ITEM_INODE_META_MOD = 0x400;
  const ITEM_MODIFIED = 0x1000;
  const ITEM_IS_FILE = 0x10000;
  const ITEM_IS_DIR = 0x20000;
  const events: [string, number][] = [
    ["/real/project/edited.ts", ITEM_MODIFIED | ITEM_IS_FILE],
    ["/real/project/created.ts", ITEM_CREATED | ITEM_MODIFIED | ITEM_IS_FILE],
    ["/real/project/src/removed.ts", ITEM_REMOVED | ITEM_IS_FILE],
    ["/real/project", ITEM_INODE_META_MOD | ITEM_IS_DIR],
    ["/real/project/src", 0x1 | 0x4],
    ["/real/project", 0x20],
    ["/elsewhere/file.ts", ITEM_MODIFIED | ITEM_IS_FILE],
  ];
  for (const stream of streams) {
    for (const [file, flags] of events) stream.handler(file, flags, 1);
  }
  const received = (id: number) =>
    broker.sent
      .filter((message) => message.id === id && message.ready !== true)
      .map((message) =>
        message.gap === true
          ? "gap"
          : `${String(message.eventType)} ${String(message.filename)}`,
      );
  assert.deepEqual(received(1), [
    "change edited.ts",
    "rename created.ts",
    "rename src/removed.ts",
    "gap",
    "gap",
    "gap",
  ]);
  assert.deepEqual(received(2), [
    "change edited.ts",
    "rename created.ts",
    "gap",
    "gap",
    "gap",
  ]);
  assert.ok(
    broker.sent.every(
      (message) =>
        message.directory === undefined || message.directory === linked,
    ),
    "events name the directory as it was registered",
  );

  broker.receive({ id: 1, op: "remove" });
  assert.deepEqual(
    streams.map((stream) => stream.stopped),
    [true, false],
  );

  for (const [label, source] of [
    ["an absent binding", watchBrokerSource(null)],
    ["a binding that cannot be loaded", watchBrokerSource("/missing.js")],
  ] as const) {
    const opened = streams.length;
    const failing = runWatchBrokerProgram(source, {
      "/fake/fsevents.js": binding,
      "node:fs": {},
    });
    failing.receive({
      allEvents: true,
      id: 1,
      locations: [{ directory: linked }],
      op: "add",
    });
    assert.deepEqual(
      failing.sent.slice(),
      [{ failed: true, id: 1, ready: true }],
      label,
    );
    assert.equal(streams.length, opened, `${label} opens nothing`);
  }
}
