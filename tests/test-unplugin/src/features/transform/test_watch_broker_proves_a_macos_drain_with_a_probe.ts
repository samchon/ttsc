import assert from "node:assert/strict";
import path from "node:path";

import { watchBrokerSource } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/watchBrokerSource.mjs";
import { runWatchBrokerProgram } from "../../internal/watch-broker/runWatchBrokerProgram";

/**
 * Verifies the watch broker's macOS backend proves a stream through probes
 * written below its root, at its opening and at every drain, and names the
 * watches of the streams it cannot prove (samchon/ttsc#1453,
 * samchon/ttsc#1454).
 *
 * FSEvents delivers with a latency, so turns of the child's loop prove nothing
 * there, and a stream created now still delivers the writes made just before
 * it: a delivery right after a synchronous edit settled a silent tracker and
 * served the old output, and a generation opened right after an edit heard that
 * edit as one of its own and compiled the project again. FSEvents preserves
 * order within one stream, so a probe heard on a stream proves every earlier
 * event of it has arrived, and nothing heard before the opening probe belongs
 * to the stream's own time.
 *
 * 1. Register a location with a probe below its root, and one without, on a
 *    stand-in binding; assert the probed stream opens at the probe's root, the
 *    other at its own directory, and that the registration is not ready until
 *    the opening probe is heard, discarding the events delivered before it.
 * 2. Ask for a drain, and assert the child writes one probe and does not answer
 *    while the probe has not been heard, even across turns of its loop.
 * 3. Deliver the probe's event, and assert the drain is answered naming only the
 *    unprobed watch as unproven, and the probe is removed.
 * 4. Deliver an event of the probed location through its root stream, and assert
 *    it reaches its registration placed against the location; then ask for a
 *    drain and remove the registration before its probe is heard, and assert
 *    the drain is answered at once with the closed watch unproven.
 */
export async function test_watch_broker_proves_a_macos_drain_with_a_probe(): Promise<void> {
  const streams: {
    handler: (file: string, flags: number, id: number) => void;
    root: string;
  }[] = [];
  const binding = {
    watch: (
      root: string,
      handler: (file: string, flags: number, id: number) => void,
    ) => {
      streams.push({ handler, root });
      return () => Promise.resolve();
    },
  };
  const written: string[] = [];
  const removed: string[] = [];
  const broker = runWatchBrokerProgram(watchBrokerSource("/fake/fsevents.js"), {
    "/fake/fsevents.js": binding,
    // The child joins paths as the platform it runs on does; here that is
    // macOS, so its paths are POSIX.
    "node:path": path.posix,
    "node:fs": {
      mkdirSync: () => undefined,
      realpathSync: { native: (file: string) => file },
      rm: (file: string, _options: object, callback: () => void) => {
        removed.push(file);
        callback();
      },
      writeFileSync: (file: string) => {
        written.push(file);
      },
    },
  });
  const ITEM_CREATED = 0x100;
  const ITEM_IS_FILE = 0x10000;
  const turns = () =>
    new Promise((resolve) => setImmediate(() => setImmediate(resolve)));
  const probes = () => written.filter((file) => file.includes("/probes/"));

  broker.receive({
    allEvents: true,
    id: 1,
    locations: [
      {
        directory: "/project/src",
        probe: {
          directory: "/project/node_modules/.cache/ttsc/probes",
          root: "/project",
        },
      },
    ],
    op: "add",
  });
  assert.deepEqual(
    streams.map((stream) => stream.root),
    ["/project"],
  );
  assert.equal(probes().length, 1, "one opening probe");
  await turns();
  assert.deepEqual(
    broker.sent.filter((message) => message.id === 1),
    [],
    "not ready until the opening probe is heard",
  );
  // The past, delivered after the stream opened.
  streams[0]!.handler("/project/src/old.ts", ITEM_CREATED | ITEM_IS_FILE, 1);
  streams[0]!.handler(probes()[0]!, ITEM_CREATED | ITEM_IS_FILE, 1);
  assert.deepEqual(
    broker.sent.filter((message) => message.id === 1),
    [{ failed: false, id: 1, ready: true }],
    "ready once the opening probe is heard, and the past discarded",
  );
  assert.deepEqual(removed, [probes()[0]], "the opening probe is removed");

  broker.receive({
    allEvents: true,
    id: 2,
    locations: [{ directory: "/elsewhere/types" }],
    op: "add",
  });
  assert.deepEqual(
    streams.map((stream) => stream.root),
    ["/project", "/elsewhere/types"],
    "a probed location's stream opens at the probe's root",
  );
  assert.deepEqual(
    broker.sent.filter((message) => message.id === 2),
    [{ failed: false, id: 2, ready: true }],
    "an unprobed stream is ready at once",
  );

  broker.receive({ id: 100, op: "drain" });
  assert.equal(probes().length, 2, "one probe per provable stream");
  await turns();
  await turns();
  assert.equal(
    broker.sent.some((message) => message.drained === true),
    false,
    "the drain waits for the probe, however many turns pass",
  );

  streams[0]!.handler(probes()[1]!, ITEM_CREATED | ITEM_IS_FILE, 1);
  await turns();
  const drained = broker.sent.find((message) => message.drained === true);
  assert.deepEqual(drained, {
    drained: true,
    id: 100,
    unproven: [{ directory: "/elsewhere/types", id: 2 }],
  });
  assert.deepEqual(removed, probes(), "the probe is removed once heard");
  assert.equal(
    broker.sent.some((message) => message.id === 1 && message.filename),
    false,
    "a probe is not an event of the location",
  );

  streams[0]!.handler("/project/src/a.ts", ITEM_CREATED | ITEM_IS_FILE, 1);
  streams[0]!.handler("/project/other/b.ts", ITEM_CREATED | ITEM_IS_FILE, 1);
  assert.deepEqual(
    broker.sent.filter((message) => message.filename !== undefined),
    [
      {
        directory: "/project/src",
        eventType: "rename",
        filename: "a.ts",
        id: 1,
      },
    ],
    "only events below the location reach it, placed against the location",
  );

  broker.receive({ id: 101, op: "drain" });
  assert.equal(probes().length, 3);
  broker.receive({ id: 1, op: "remove" });
  await turns();
  assert.deepEqual(
    broker.sent.filter((message) => message.id === 101),
    [
      {
        drained: true,
        id: 101,
        unproven: [
          { directory: "/elsewhere/types", id: 2 },
          { directory: "/project/src", id: 1 },
        ],
      },
    ],
    "a watch closed before its probe is heard is unproven, not awaited",
  );
}
