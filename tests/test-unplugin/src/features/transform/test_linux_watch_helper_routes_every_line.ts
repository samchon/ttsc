import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";

import type { LinuxWatchHelper } from "../../../../../packages/unplugin/lib/core/transform/tracker/linux/LinuxWatchHelper.mjs";
import { routeLinuxWatchHelperLine } from "../../../../../packages/unplugin/lib/core/transform/tracker/linux/routeLinuxWatchHelperLine.mjs";

/**
 * Verifies each line of the Linux watch helper reaches the subscription or sync
 * it names, and an overflow reaches every subscription (samchon/ttsc#1426).
 *
 * The kernel drops events once an inotify queue is full and says so with one
 * IN_Q_OVERFLOW event, which libuv discards, so a Linux watch opened through
 * `fs.watch` could lose events without notice. The helper reports it instead,
 * and the adapter must pass it to every watch as an event without a name.
 *
 * 1. Route malformed lines and lines for unknown ids, and assert nothing happens.
 * 2. Answer two subscriptions, one live and one refused, and assert each hears its
 *    answer, the refused one is forgotten, and each answer releases its hold on
 *    the helper.
 * 3. Route a named change, a named rename, and an overflow, and assert the events
 *    reach their subscription and the overflow reaches every one.
 * 4. End a subscription whose directory went away, and answer a sync, and assert
 *    the subscription is forgotten and the sync released.
 */
export async function test_linux_watch_helper_routes_every_line(): Promise<void> {
  const references: string[] = [];
  const output = {
    ref: () => references.push("ref"),
    unref: () => references.push("unref"),
  };
  const helper: LinuxWatchHelper = {
    answered: false,
    child: {
      ref: () => undefined,
      stdout: output,
      unref: () => undefined,
    } as unknown as ChildProcess,
    nextId: 10,
    pending: 2,
    subscriptions: new Map(),
    syncs: new Map(),
  };
  const heard: string[] = [];
  const subscribe = (id: number): void => {
    helper.subscriptions.set(id, {
      end: () => heard.push(`${id} end`),
      event: (eventType, filename) =>
        heard.push(`${id} ${eventType} ${String(filename)}`),
      ready: (live) => heard.push(`${id} ready ${String(live)}`),
    });
  };
  subscribe(1);
  subscribe(2);

  for (const line of ["", "not json", "null", '"text"', '{"id":"1"}']) {
    routeLinuxWatchHelperLine(helper, line);
  }
  routeLinuxWatchHelperLine(helper, '{"id":99,"ready":true}');
  routeLinuxWatchHelperLine(helper, '{"id":99,"synced":true}');
  assert.deepEqual(heard, []);

  routeLinuxWatchHelperLine(helper, '{"id":1,"ready":true}');
  routeLinuxWatchHelperLine(
    helper,
    '{"id":2,"error":"no space left on device"}',
  );
  assert.deepEqual(heard.splice(0), ["1 ready true", "2 ready false"]);
  assert.equal(helper.subscriptions.has(2), false, "a refusal forgets it");
  assert.equal(helper.pending, 0, "each answer releases its hold");
  assert.deepEqual(references, ["unref"]);
  assert.equal(helper.answered, true);

  subscribe(3);
  routeLinuxWatchHelperLine(helper, '{"id":1,"type":"change","name":"a.ts"}');
  routeLinuxWatchHelperLine(helper, '{"id":3,"type":"rename","name":"b"}');
  routeLinuxWatchHelperLine(helper, '{"overflow":true}');
  assert.deepEqual(heard.splice(0), [
    "1 change a.ts",
    "3 rename b",
    "1 rename null",
    "3 rename null",
  ]);

  let synced: boolean | undefined;
  helper.syncs.set(20, (answered) => {
    synced = answered;
  });
  routeLinuxWatchHelperLine(helper, '{"id":3,"gone":true}');
  routeLinuxWatchHelperLine(helper, '{"id":20,"synced":true}');
  assert.deepEqual(heard.splice(0), ["3 end"]);
  assert.equal(helper.subscriptions.has(3), false, "a gone watch is forgotten");
  assert.equal(synced, true);
}
