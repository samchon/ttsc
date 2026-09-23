import assert from "node:assert/strict";
import path from "node:path";

import type { WatchBroker } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/WatchBroker.mjs";
import type { WatchBrokerSink } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/WatchBrokerSink.mjs";
import { routeWatchBrokerMessage } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/routeWatchBrokerMessage.mjs";

/**
 * Verifies every message of the isolated watch process reaches the waiter or
 * registration it names, as the sink call it means, under the registration's
 * own spelling (samchon/ttsc#1387, samchon/ttsc#1485).
 *
 * The child multiplexes every Windows and macOS watch of the process, a
 * tracker's and an input observer's scope alike, and every drain, over one IPC
 * channel. A drain reply that released the wrong waiter would let a delivery
 * read a tracker before its events arrived, a dropped `failed` flag or `gap`
 * notice would let silence stand as proof (samchon/ttsc#1418), and an event
 * reported under the child's canonical spelling rather than the registration's
 * would compare unequal to every path the registration produced. The table is
 * pure, so it is decided here on every platform rather than only through a
 * broker process; what each call means to a tracker is
 * `test_brokered_tracker_sink_records_what_its_filters_admit`'s.
 *
 * 1. Route malformed messages, and an event for an unknown id, and assert no
 *    waiter is released and no sink is called.
 * 2. Route drain replies, proven and unproven, twice for one id, and with
 *    malformed or foreign entries, and assert each releases only its own waiter
 *    once, and every draining registration, and only a draining one, hears the
 *    verdict on its own watches in its own spelling.
 * 3. Route `ready`, `failed`, and `gap` messages, and assert each is the status
 *    call it names and never an event.
 * 4. Route events with and without a directory, a name, and an event type, and
 *    assert each reaches the sink placed under the registration's spelling.
 */
export async function test_watch_broker_messages_reach_their_registrations(): Promise<void> {
  const canonical = path.resolve("/canonical/project");
  const walked = path.resolve("/walked/PROJEC~1");
  const recordingSink = (calls: unknown[][]): WatchBrokerSink => ({
    event: (directory, filename, eventType) =>
      calls.push(["event", directory, filename, eventType]),
    failed: () => calls.push(["failed"]),
    gap: () => calls.push(["gap"]),
    unattributed: () => calls.push(["unattributed"]),
    unproven: (directories) =>
      calls.push([
        "unproven",
        directories === undefined ? undefined : [...directories],
      ]),
  });
  const broker = () => {
    const released: string[] = [];
    const calls: Record<number, unknown[][]> = { 7: [], 8: [] };
    let readied = 0;
    const state: Pick<WatchBroker, "drains" | "registrations"> = {
      drains: new Map([
        [1, () => released.push("drain 1")],
        [2, () => released.push("drain 2")],
      ]),
      registrations: new Map([
        [
          7,
          {
            drains: true,
            ready: () => {
              readied += 1;
            },
            sink: recordingSink(calls[7]!),
            spellings: new Map([[canonical, walked]]),
          },
        ],
        [
          8,
          {
            drains: false,
            ready: () => undefined,
            sink: recordingSink(calls[8]!),
            spellings: new Map(),
          },
        ],
      ]),
    };
    return {
      calls,
      readied: () => readied,
      released,
      route: (message: unknown) => routeWatchBrokerMessage(state, message),
      state,
    };
  };

  // 1. Nothing that names no live registration reaches one.
  const quiet = broker();
  for (const message of [
    null,
    "drained",
    { drained: true },
    { id: "7" },
    { directory: canonical, filename: "a.ts", id: 99 },
    { gap: true, id: 99 },
    { failed: true, id: 99, ready: true },
  ]) {
    quiet.route(message);
  }
  assert.deepEqual(quiet.released, []);
  assert.deepEqual(quiet.calls, { 7: [], 8: [] });
  assert.equal(quiet.readied(), 0);

  // 2. A drain reply releases its own waiter once, and tells every draining
  // registration the verdict on its watches.
  const drained = broker();
  drained.route({ drained: true, id: 2 });
  drained.route({ drained: true, id: 2 });
  assert.deepEqual(drained.released, ["drain 2"], "one reply, one waiter");
  assert.equal(drained.state.drains.has(1), true);
  assert.deepEqual(
    drained.calls[7],
    [
      ["unproven", undefined],
      ["unproven", undefined],
    ],
    "a reply naming nothing proves every watch",
  );
  drained.route({
    drained: true,
    id: 1,
    unproven: [
      { directory: canonical, id: 99 },
      7,
      { directory: 7, id: 7 },
      { directory: canonical, id: 7 },
      { directory: canonical, id: 8 },
    ],
  });
  assert.deepEqual(drained.released, ["drain 2", "drain 1"]);
  assert.deepEqual(
    drained.calls[7]!.at(-1),
    ["unproven", [walked]],
    "an unproven watch, in the registration's spelling",
  );
  assert.deepEqual(drained.calls[8], [], "a forwarding scope is never told");

  // 3. Status messages are status calls, never events.
  const status = broker();
  status.route({ failed: false, id: 7, ready: true });
  assert.equal(status.readied(), 1);
  assert.deepEqual(status.calls[7], []);
  status.route({ failed: true, id: 7, ready: true });
  assert.equal(status.readied(), 2, "a partial registration is still ready");
  assert.deepEqual(status.calls[7], [["failed"]]);
  status.route({ failed: true, id: 7 });
  assert.equal(status.readied(), 2, "a later failure readies nothing");
  status.route({ gap: true, id: 7 });
  assert.deepEqual(status.calls[7], [["failed"], ["failed"], ["gap"]]);

  // 4. Events reach the sink under the registration's spelling.
  const events = broker();
  events.route({ eventType: "rename", filename: null, id: 7 });
  events.route({ directory: canonical, eventType: "change", id: 7 });
  events.route({ directory: canonical, filename: "a.ts", id: 7 });
  events.route({
    directory: canonical,
    eventType: "change",
    filename: "b.ts",
    id: 7,
  });
  events.route({ directory: canonical, filename: "c.ts", id: 8 });
  assert.deepEqual(events.calls[7], [
    ["unattributed"],
    ["event", walked, null, "change"],
    ["event", walked, "a.ts", "rename"],
    ["event", walked, "b.ts", "change"],
  ]);
  assert.deepEqual(
    events.calls[8],
    [["event", canonical, "c.ts", "rename"]],
    "a directory the registration never spelled is reported as the child's",
  );
}
