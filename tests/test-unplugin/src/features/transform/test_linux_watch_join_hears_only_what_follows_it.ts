import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import path from "node:path";

import { LINUX_DIRECTORY_WATCHES } from "../../../../../packages/unplugin/lib/core/transform/tracker/linux/LINUX_DIRECTORY_WATCHES.mjs";
import { LINUX_WATCH_HELPER } from "../../../../../packages/unplugin/lib/core/transform/tracker/linux/LINUX_WATCH_HELPER.mjs";
import type { LinuxWatchHelper } from "../../../../../packages/unplugin/lib/core/transform/tracker/linux/LinuxWatchHelper.mjs";
import { routeLinuxWatchHelperLine } from "../../../../../packages/unplugin/lib/core/transform/tracker/linux/routeLinuxWatchHelperLine.mjs";
import { subscribeLinuxDirectoryWatch } from "../../../../../packages/unplugin/lib/core/transform/tracker/linux/subscribeLinuxDirectoryWatch.mjs";

/**
 * Verifies a subscriber joining a shared Linux directory watch hears only the
 * events that follow its joining, as a watch of its own would
 * (samchon/ttsc#1486).
 *
 * Every directory watch of the process is one watch in the Linux watch helper,
 * shared by every observer of the directory. A subscriber that joined a live
 * watch was added to its listeners at once, so every event line the helper had
 * already written and Node had not yet read reached it too: a capture's tracker
 * opened right after an edit heard the rest of that edit as a change during its
 * compile, judged the capture unstable, and compiled the project again. A
 * joiner now hears nothing until the helper answers a sync sent when it joined,
 * and everything after that answer. The helper is scripted here, so the order
 * of every line is decided by the test on every platform.
 *
 * 1. Open a watch, answer it, and deliver an event, and assert its opener hears it
 *    at once.
 * 2. Join the watch, and assert the join sends one sync and no second watch;
 *    deliver an event the helper wrote before the answer, and assert only the
 *    opener hears it.
 * 3. Route the sync's answer and, in the same turn, the next event, and assert
 *    both subscribers hear that event and the joiner is ready.
 * 4. Join a watch whose opening the helper has not answered yet, and assert the
 *    joiner, too, hears only what follows its own sync.
 * 5. Join once more and never answer the sync, and assert the joiner is not live,
 *    is told of the error once, and hears nothing more, while the others still
 *    do; then close every subscriber, and assert the watches are removed.
 */
export async function test_linux_watch_join_hears_only_what_follows_it(): Promise<void> {
  const previous = LINUX_WATCH_HELPER.current;
  const sent: { id: number; op: string; path?: string }[] = [];
  const quiet = { ref: () => undefined, unref: () => undefined };
  const helper: LinuxWatchHelper = {
    answered: false,
    child: {
      ...quiet,
      stdin: {
        destroyed: false,
        writable: true,
        write: (line: string) => {
          sent.push(JSON.parse(line) as (typeof sent)[number]);
          return true;
        },
      },
      stdout: quiet,
    } as unknown as ChildProcess,
    nextId: 1,
    pending: 0,
    subscriptions: new Map(),
    syncs: new Map(),
  };
  const route = (line: object): void =>
    routeLinuxWatchHelperLine(helper, JSON.stringify(line));
  const heard: string[] = [];
  const errors: string[] = [];
  const subscribe = (name: string, directory: string) =>
    subscribeLinuxDirectoryWatch(
      directory,
      (eventType, filename) => heard.push(`${name} ${eventType} ${filename}`),
      () => errors.push(name),
    );
  const source = path.resolve("/scripted/join/src");
  const types = path.resolve("/scripted/join/types");
  LINUX_WATCH_HELPER.current = helper;
  try {
    // 1. The opener hears from the helper's answer on.
    const opener = subscribe("opener", source);
    assert.deepEqual(sent.splice(0), [{ id: 1, op: "add", path: source }]);
    route({ id: 1, ready: true });
    assert.equal(await opener.ready, true);
    route({ id: 1, name: "a.ts", type: "change" });
    assert.deepEqual(heard.splice(0), ["opener change a.ts"]);

    // 2. A joiner does not hear the tail written before it joined.
    const joiner = subscribe("joiner", source);
    assert.deepEqual(sent.splice(0), [{ id: 2, op: "sync" }]);
    route({ id: 1, name: "b.ts", type: "change" });
    assert.deepEqual(heard.splice(0), ["opener change b.ts"]);

    // 3. It hears the very next line after the answer.
    route({ id: 2, synced: true });
    route({ id: 1, name: "c.ts", type: "rename" });
    assert.deepEqual(heard.splice(0), [
      "opener rename c.ts",
      "joiner rename c.ts",
    ]);
    assert.equal(await joiner.ready, true);

    // 4. Joining a watch that is not live yet waits for the join's own sync.
    const early = subscribe("early", types);
    const late = subscribe("late", types);
    assert.deepEqual(sent.splice(0), [
      { id: 3, op: "add", path: types },
      { id: 4, op: "sync" },
    ]);
    route({ id: 3, ready: true });
    route({ id: 3, name: "global.d.ts", type: "change" });
    assert.deepEqual(heard.splice(0), ["early change global.d.ts"]);
    route({ id: 4, synced: true });
    route({ id: 3, name: "extra.d.ts", type: "rename" });
    assert.deepEqual(heard.splice(0), [
      "early rename extra.d.ts",
      "late rename extra.d.ts",
    ]);
    assert.deepEqual([await early.ready, await late.ready], [true, true]);

    // 5. A join the helper never answers is not live.
    const unanswered = subscribe("unanswered", source);
    assert.deepEqual(sent.splice(0), [{ id: 5, op: "sync" }]);
    assert.equal(await unanswered.ready, false);
    assert.deepEqual(errors, ["unanswered"], "told once, alone");
    route({ id: 1, name: "d.ts", type: "change" });
    assert.deepEqual(heard.splice(0), [
      "opener change d.ts",
      "joiner change d.ts",
    ]);
    for (const subscription of [opener, joiner, early, late, unanswered]) {
      subscription.close();
    }
    assert.deepEqual(sent.splice(0), [
      { id: 1, op: "remove" },
      { id: 3, op: "remove" },
    ]);
    assert.equal(LINUX_DIRECTORY_WATCHES.has(source), false);
    assert.equal(LINUX_DIRECTORY_WATCHES.has(types), false);
  } finally {
    LINUX_WATCH_HELPER.current = previous;
  }
}
