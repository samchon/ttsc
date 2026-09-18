import assert from "node:assert/strict";
import path from "node:path";

import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/lib/core/transform/tracker/TtscProjectMutationTracker.mjs";
import type { WatchBroker } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/WatchBroker.mjs";
import { routeWatchBrokerMessage } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/routeWatchBrokerMessage.mjs";

/**
 * Verifies every message of the isolated watch process reaches the waiter or
 * tracker it names, and records what that tracker's filters admit
 * (samchon/ttsc#1387).
 *
 * The child multiplexes every Windows and macOS tracker and every drain over
 * one IPC channel. A drain reply that released the wrong waiter would let a
 * delivery read a tracker before its events arrived, a dropped `failed` flag or
 * `gap` notice would let silence stand as proof (samchon/ttsc#1418), and an
 * event recorded under the child's canonical spelling rather than the walk's
 * would compare unequal to every input. The table is pure, so it is decided
 * here on every platform rather than only through a broker process.
 *
 * 1. Route malformed, drain, stale, `ready`, `failed`, and `gap` messages, and
 *    assert each resolves exactly its own waiter, flag, or handler.
 * 2. Route events through a classifier, through the project-directory filters, and
 *    through no filter, and assert the witness each records under the walk's
 *    spelling.
 */
export async function test_watch_broker_messages_reach_their_trackers(): Promise<void> {
  const canonical = path.resolve("/canonical/project");
  const walked = path.resolve("/walked/PROJEC~1");
  const tracker = (): TtscProjectMutationTracker => ({
    changes: new Set(),
    changesOmitted: false,
    close: () => undefined,
    failed: false,
    membershipChanged: false,
  });
  type Registration = Parameters<WatchBroker["trackers"]["set"]>[1];
  const broker = (
    registration: Partial<Registration> = {},
  ): {
    readied: () => number;
    released: string[];
    route: (message: unknown) => void;
    state: Pick<WatchBroker, "drains" | "trackers">;
    tracker: TtscProjectMutationTracker;
  } => {
    let readied = 0;
    const released: string[] = [];
    const owned = tracker();
    const state: Pick<WatchBroker, "drains" | "trackers"> = {
      drains: new Map([
        [1, () => released.push("drain 1")],
        [2, () => released.push("drain 2")],
      ]),
      trackers: new Map([
        [
          7,
          {
            ready: () => {
              readied += 1;
            },
            spellings: new Map([[canonical, walked]]),
            tracker: owned,
            ...registration,
          },
        ],
      ]),
    };
    return {
      readied: () => readied,
      released,
      route: (message) => routeWatchBrokerMessage(state, message),
      state,
      tracker: owned,
    };
  };
  const recorded = (target: TtscProjectMutationTracker) => ({
    changes: [...target.changes],
    failed: target.failed,
    membershipChanged: target.membershipChanged,
  });

  const plain = broker();
  for (const message of [null, "drained", { drained: true }, { id: "7" }]) {
    plain.route(message);
  }
  plain.route({ directory: canonical, filename: "a.ts", id: 99 });
  assert.deepEqual(plain.released, []);
  assert.deepEqual(recorded(plain.tracker), recorded(tracker()));

  plain.route({ drained: true, id: 2 });
  plain.route({ drained: true, id: 2 });
  assert.deepEqual(plain.released, ["drain 2"], "one reply, one waiter");
  assert.equal(plain.state.drains.has(1), true);

  plain.route({ failed: false, id: 7, ready: true });
  assert.equal(plain.readied(), 1);
  assert.equal(plain.tracker.failed, false);
  plain.route({ failed: true, id: 7, ready: true });
  assert.equal(plain.readied(), 2, "a partial registration is still ready");
  assert.equal(plain.tracker.failed, true);
  assert.deepEqual(
    plain.tracker.changes,
    new Set(),
    "a status message is not an event",
  );

  // A gap leaves a tracker unverified, since it hears everything after it but
  // nothing inside it, and is answered by a registration that re-checks
  // instead; either way nothing is recorded.
  const gapped = broker();
  gapped.route({ gap: true, id: 99 });
  assert.equal(
    gapped.tracker.unverified,
    undefined,
    "a stale gap reaches no one",
  );
  gapped.route({ gap: true, id: 7 });
  assert.deepEqual(recorded(gapped.tracker), recorded(tracker()));
  assert.equal(gapped.tracker.unverified, true);
  let rechecked = 0;
  const answered = broker({
    gap: () => {
      rechecked += 1;
    },
  });
  answered.route({ gap: true, id: 7 });
  assert.equal(rechecked, 1);
  assert.deepEqual(recorded(answered.tracker), recorded(tracker()));

  const unattributed = broker();
  unattributed.route({ eventType: "rename", filename: null, id: 7 });
  assert.deepEqual(recorded(unattributed.tracker), {
    changes: [],
    failed: false,
    membershipChanged: true,
  });

  const unfiltered = broker();
  unfiltered.route({ directory: canonical, eventType: "change", id: 7 });
  unfiltered.route({
    directory: canonical,
    eventType: "change",
    filename: "a.ts",
    id: 7,
  });
  assert.deepEqual(recorded(unfiltered.tracker), {
    changes: [walked, path.join(walked, "a.ts")],
    failed: false,
    membershipChanged: true,
  });

  const heard: [string, string | null, string][] = [];
  const classified = broker({
    classify: (location, filename, eventType) => {
      heard.push([location, filename, eventType]);
      return filename === "input.d.ts"
        ? "change"
        : filename === "candidate.ts"
          ? "mutation"
          : undefined;
    },
    membership: () => true,
  });
  classified.route({ directory: canonical, filename: "cache.bin", id: 7 });
  assert.deepEqual(recorded(classified.tracker), recorded(tracker()));
  classified.route({
    directory: canonical,
    eventType: "change",
    filename: "input.d.ts",
    id: 7,
  });
  assert.deepEqual(recorded(classified.tracker), {
    changes: [path.join(walked, "input.d.ts")],
    failed: false,
    membershipChanged: false,
  });
  classified.route({ directory: canonical, filename: "candidate.ts", id: 7 });
  assert.equal(classified.tracker.membershipChanged, true);
  assert.deepEqual(
    heard,
    [
      [walked, "cache.bin", "rename"],
      [walked, "input.d.ts", "change"],
      [walked, "candidate.ts", "rename"],
    ],
    "the classifier alone decides, under the walk's spelling",
  );

  const filtered = () =>
    broker({
      changeAddsMembership: (_location, filename) => filename === "new.ts",
      content: (_location, filename) => filename.endsWith(".ts"),
      membership: (_location, filename) => filename.endsWith(".ts"),
    });
  const rows: [string, string, ReturnType<typeof recorded>][] = [
    [
      "rename",
      "added.ts",
      {
        changes: [path.join(walked, "added.ts")],
        failed: false,
        membershipChanged: true,
      },
    ],
    [
      "change",
      "new.ts",
      {
        changes: [path.join(walked, "new.ts")],
        failed: false,
        membershipChanged: true,
      },
    ],
    [
      "change",
      "main.ts",
      {
        changes: [path.join(walked, "main.ts")],
        failed: false,
        membershipChanged: false,
      },
    ],
    ["rename", "bundle.js", recorded(tracker())],
    ["change", "bundle.js", recorded(tracker())],
  ];
  for (const [eventType, filename, expected] of rows) {
    const target = filtered();
    target.route({ directory: canonical, eventType, filename, id: 7 });
    assert.deepEqual(
      recorded(target.tracker),
      expected,
      `${eventType} ${filename}`,
    );
  }
}
