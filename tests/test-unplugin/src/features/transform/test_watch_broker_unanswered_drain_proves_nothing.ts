import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";

import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/lib/core/transform/tracker/TtscProjectMutationTracker.mjs";
import type { WatchBroker } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/WatchBroker.mjs";
import { drainWatchBroker } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/drainWatchBroker.mjs";
import { routeWatchBrokerMessage } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/routeWatchBrokerMessage.mjs";
import { settleMutationTrackers } from "../../../../../packages/unplugin/lib/core/transform/tracker/settleMutationTrackers.mjs";

/**
 * Verifies a drain the watch broker never answered proves nothing, and leaves
 * its tracker unverified (samchon/ttsc#1428).
 *
 * A delivery settles its trackers before it reads their silence. A broker drain
 * used to give up after 10 ms and resolve as if the child had answered, so on a
 * busy host an edit whose event was still in flight was read as no edit, and
 * the delivery served the cached output.
 *
 * 1. Drain a broker whose child answers, and one whose child cannot be sent the
 *    request, and assert the first held and the second did not.
 * 2. Drain a broker whose child never answers, with a short wait, and assert the
 *    drain gives up without holding once the wait runs out.
 * 3. Settle a tracker whose drain held and one whose drain did not, and assert
 *    only the second is unverified.
 */
export async function test_watch_broker_unanswered_drain_proves_nothing(): Promise<void> {
  const openBroker = (send: (message: { id: number }) => boolean) => {
    const child = {
      ref: () => undefined,
      send,
      unref: () => undefined,
    } as unknown as ChildProcess;
    const broker: WatchBroker = {
      child,
      drains: new Map(),
      nextId: 1,
      pendingDrains: 0,
      pendingRegistrations: 0,
      probes: false,
      registrations: new Map(),
    };
    return broker;
  };

  const answering: WatchBroker = openBroker((message) => {
    queueMicrotask(() =>
      routeWatchBrokerMessage(answering, { drained: true, id: message.id }),
    );
    return true;
  });
  assert.equal(await drainWatchBroker(answering), true, "an answered drain");
  assert.equal(
    await drainWatchBroker(openBroker(() => false)),
    false,
    "a drain the child never received",
  );

  const silent = openBroker(() => true);
  const started = Date.now();
  assert.equal(
    await drainWatchBroker(silent, 100),
    false,
    "an unanswered drain",
  );
  assert.ok(Date.now() - started >= 90, "it waited for a busy child first");
  assert.equal(silent.drains.size, 0);
  assert.equal(silent.pendingDrains, 0);

  const tracker = (held: boolean): TtscProjectMutationTracker => ({
    changes: new Set(),
    changesOmitted: false,
    close: () => undefined,
    drain: async () => held,
    failed: false,
    membershipChanged: false,
  });
  const proven = tracker(true);
  const unproven = tracker(false);
  await settleMutationTrackers([proven, undefined, unproven]);
  assert.equal(proven.unverified, undefined, "a held drain proves silence");
  assert.equal(unproven.unverified, true, "an unheld one proves nothing");
}
