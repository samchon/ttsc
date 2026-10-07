import assert from "node:assert/strict";
import path from "node:path";

import { watchBrokerSource } from "../../../../../packages/unplugin/src/core/transform/tracker/broker/watchBrokerSource";
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
 * order within one stream, so a clean probe establishes its delivery frontier.
 * A dropped flag independently withdraws authority even on that probe path; the
 * flagged callback alone cannot establish opening or drain proof. The child
 * discards callbacks before the clean opening frontier; this is not an atomic
 * timestamp classification of writes.
 *
 * 1. Register a location with a probe below its root, and one without, on a
 *    stand-in binding; assert the probed stream opens at the probe's root, the
 *    other at its own directory, and that the registration is not ready until a
 *    clean opening probe is heard, discarding earlier events. A dropped
 *    matching probe first reports a gap without proving readiness.
 * 2. Ask for a drain, and assert the child writes one probe and does not answer
 *    while a clean probe has not been heard, even across turns of its loop or
 *    after a matching dropped probe reports a gap.
 * 3. Deliver the probe's event, and assert the drain is answered naming only the
 *    unprobed watch as unproven, and the probe is removed; then register a
 *    second location below the same root, and assert one drain writes one probe
 *    for both streams and is answered once each has heard it.
 * 4. Deliver an event of the probed location through its root stream, and assert
 *    it reaches its registration placed against the location; then ask for a
 *    drain and remove the registration before its probe is heard, and assert
 *    the drain is answered at once with the closed watch unproven.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs watchBrokerSource with a scripted FSEvents binding; asserts stream roots, opening readiness, old-event suppression, drain waiting, matching dropped opening/drain probes reporting gaps without establishing proof, unproven names, shared probes, exact event routing and removal-before-proof completion.
 * @evidence contracts/testing.md#independent-expectations Ordered FSEvents probes establish a stream frontier; loop turns alone cannot. Explicit created/file/kernel-dropped flag values, event sequence and literal gap/drain messages provide an oracle independent of probe state tracking. A matching filename cannot erase the independent dropped-events warning.
 * @evidence contracts/testing.md#distinguishing-cases Owns probed/unprobed streams, two streams sharing a probe directory, pre/post-opening events, matching clean versus dropped opening/drain probes and a closed pending stream. Clean callbacks retain positive proof after the flagged callback alone fails to qualify it. Mock streams and probe arrays have no native lifetime, so this test does not exercise the real fsevents binding's event ordering.
 * @evidence contracts/testing.md#execution-ownership Unit test: runs the real broker child program text (watchBrokerSource) in this process through runWatchBrokerProgram, which evaluates it with new Function and a fake process whose send method records messages and whose registered message handlers receive test input; the fsevents binding is a stub whose watch() records each stream's root and handler, node:path is path.posix, and node:fs records written and removed probe files instead of touching disk. The test fires the stream events itself; no child process, real FSEventStream or macOS is involved.
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
  const KERNEL_DROPPED = 0x4;
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
  streams[0]!.handler(
    probes()[0]!,
    ITEM_CREATED | ITEM_IS_FILE | KERNEL_DROPPED,
    1,
  );
  await turns();
  assert.deepEqual(
    broker.sent.filter((message) => message.id === 1),
    [{ gap: true, id: 1 }],
    "a dropped matching opening probe withdraws authority without proving readiness",
  );
  assert.deepEqual(
    removed,
    [],
    "a dropped opening callback alone does not complete its probe",
  );
  streams[0]!.handler(probes()[0]!, ITEM_CREATED | ITEM_IS_FILE, 1);
  assert.deepEqual(
    broker.sent.filter((message) => message.id === 1),
    [
      { gap: true, id: 1 },
      { failed: false, id: 1, ready: true },
    ],
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

  streams[0]!.handler(
    probes()[1]!,
    ITEM_CREATED | ITEM_IS_FILE | KERNEL_DROPPED,
    1,
  );
  await turns();
  assert.deepEqual(
    broker.sent.filter((message) => message.gap === true),
    [
      { gap: true, id: 1 },
      { gap: true, id: 1 },
    ],
    "matching dropped opening and drain callbacks each report their gap",
  );
  assert.equal(
    broker.sent.some((message) => message.id === 100),
    false,
    "a dropped matching drain probe is not successful delivery proof",
  );
  assert.deepEqual(
    removed,
    [probes()[0]],
    "the dropped drain callback leaves its probe pending",
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

  broker.receive({
    allEvents: true,
    id: 3,
    locations: [
      {
        directory: "/project/lib",
        probe: {
          directory: "/project/node_modules/.cache/ttsc/probes",
          root: "/project",
        },
      },
    ],
    op: "add",
  });
  streams[2]!.handler(probes()[2]!, ITEM_CREATED | ITEM_IS_FILE, 1);
  broker.receive({ id: 102, op: "drain" });
  assert.equal(probes().length, 4, "one probe per probe directory");
  streams[0]!.handler(probes()[3]!, ITEM_CREATED | ITEM_IS_FILE, 1);
  await turns();
  assert.equal(
    broker.sent.some((message) => message.id === 102),
    false,
    "answered only once every stream rooted there has heard it",
  );
  streams[2]!.handler(probes()[3]!, ITEM_CREATED | ITEM_IS_FILE, 1);
  await turns();
  assert.deepEqual(
    broker.sent.find((message) => message.id === 102),
    {
      drained: true,
      id: 102,
      unproven: [{ directory: "/elsewhere/types", id: 2 }],
    },
  );
  broker.receive({ id: 3, op: "remove" });

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
  assert.equal(probes().length, 5);
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
