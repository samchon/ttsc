import assert from "node:assert/strict";
import path from "node:path";

import { watchBrokerSource } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/watchBrokerSource.mjs";
import { runWatchBrokerProgram } from "../../internal/watch-broker/runWatchBrokerProgram";

/**
 * Verifies the watch broker's macOS backend answers a drain only once each
 * stream it can prove has delivered a probe written for that drain, and names
 * the registrations of the streams it cannot prove (samchon/ttsc#1453).
 *
 * FSEvents delivers with a latency, so turns of the child's loop prove nothing
 * there, and a delivery made right after a synchronous edit settled a silent
 * tracker and served the old output. FSEvents preserves order within one
 * stream, so a probe heard on a stream proves every earlier event of it has
 * arrived.
 *
 * 1. Register a location with a probe below its root, and one without, on a
 *    stand-in binding; assert the probed stream opens at the probe's root and
 *    the other at its own directory.
 * 2. Ask for a drain, and assert the child writes one probe and does not answer
 *    while the probe has not been heard, even across turns of its loop.
 * 3. Deliver the probe's event, and assert the drain is answered naming only the
 *    unprobed registration as unproven, and the probe is removed.
 * 4. Deliver an event of the probed location through its root stream, and assert
 *    it reaches its registration placed against the location.
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

  broker.receive({ id: 100, op: "drain" });
  assert.equal(written.length, 1, "one probe per provable stream");
  assert.ok(
    written[0]!.startsWith("/project/node_modules/.cache/ttsc/probes/"),
  );
  const turns = () =>
    new Promise((resolve) => setImmediate(() => setImmediate(resolve)));
  await turns();
  await turns();
  assert.equal(
    broker.sent.some((message) => message.drained === true),
    false,
    "the drain waits for the probe, however many turns pass",
  );

  const ITEM_CREATED = 0x100;
  const ITEM_IS_FILE = 0x10000;
  streams[0]!.handler(written[0]!, ITEM_CREATED | ITEM_IS_FILE, 1);
  await turns();
  const drained = broker.sent.find((message) => message.drained === true);
  assert.deepEqual(drained, { drained: true, id: 100, unproven: [2] });
  assert.deepEqual(removed, [written[0]], "the probe is removed once heard");
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
}
