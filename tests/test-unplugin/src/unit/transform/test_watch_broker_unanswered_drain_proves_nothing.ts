import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";

import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/TtscProjectMutationTracker";
import type { WatchBroker } from "../../../../../packages/unplugin/src/core/transform/tracker/broker/WatchBroker";
import { drainWatchBroker } from "../../../../../packages/unplugin/src/core/transform/tracker/broker/drainWatchBroker";
import { routeWatchBrokerMessage } from "../../../../../packages/unplugin/src/core/transform/tracker/broker/routeWatchBrokerMessage";
import { settleMutationTrackers } from "../../../../../packages/unplugin/src/core/transform/tracker/settleMutationTrackers";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Calls drainWatchBroker, routeWatchBrokerMessage and settleMutationTrackers with scripted children; asserts answered drain true, send failure/timeout false, elapsed timeout, empty pending state and unverified only for unheld trackers.
 * @evidence contracts/testing.md#independent-expectations A drain certifies delivery only when the child actually acknowledges. Literal booleans and tracker authority follow this protocol contract; the elapsed lower bound distinguishes waiting for a busy child from immediate abandonment.
 * @evidence contracts/testing.md#distinguishing-cases Owns answered, unsent and silent requests, undefined tracker input, held/unheld tracker settlement and timeout cleanup. Child methods are local stand-ins, so native IPC ordering is outside this unit case.
 * @evidence contracts/testing.md#execution-ownership Unit entry test_watch_broker_unanswered_drain_proves_nothing is discovered under src/unit/transform by TestExecutor. It invokes the owning operations in the test process against controlled fixture inputs; the assertions moved from features and source imports replace built package imports and this entry owns no dynamically registered cases.
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
