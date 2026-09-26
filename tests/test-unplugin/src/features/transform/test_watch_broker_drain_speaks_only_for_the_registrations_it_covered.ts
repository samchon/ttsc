import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";

import type { WatchBroker } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/WatchBroker.mjs";
import { drainWatchBroker } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/drainWatchBroker.mjs";
import { routeWatchBrokerMessage } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/routeWatchBrokerMessage.mjs";

/**
 * Verifies a broker drain's reply reaches only the registrations its request
 * covered, and a later registration takes a drain of its own.
 *
 * The child probes the registrations it holds when a drain request reaches it.
 * A registration opened after that request was sent shared the in-flight drain,
 * and the reply's verdict was applied to every registration present when it
 * arrived, so the late one was told its never-probed watches were proven. On
 * macOS that let FSEvents silence stand for a filesystem recheck
 * (samchon/ttsc#1546).
 *
 * 1. Drain for registration A, then register B, and drain for B and again for A.
 * 2. Assert A shares the in-flight drain and B's starts a new one.
 * 3. Answer the first drain, then the second, and assert each verdict reached only
 *    the registrations its request covered.
 */
export async function test_watch_broker_drain_speaks_only_for_the_registrations_it_covered(): Promise<void> {
  const sent: number[] = [];
  const child = {
    ref: () => undefined,
    send: (message: { id: number }) => {
      sent.push(message.id);
      return true;
    },
    unref: () => undefined,
  } as unknown as ChildProcess;
  const broker: WatchBroker = {
    child,
    drains: new Map(),
    nextId: 1,
    pendingDrains: 0,
    pendingRegistrations: 0,
    probes: true,
    registrations: new Map(),
  };
  const verdicts: string[] = [];
  const register = (id: number): void => {
    broker.registrations.set(id, {
      drains: true,
      ready: () => undefined,
      sink: {
        event: () => undefined,
        failed: () => undefined,
        gap: () => undefined,
        unattributed: () => undefined,
        unproven: (directories) =>
          verdicts.push(`${id}:${directories === undefined ? "proven" : "unproven"}`),
      },
      spellings: new Map(),
    });
  };
  broker.nextId = 100;
  register(1);

  const first = drainWatchBroker(broker, 10_000, 1);
  register(2);
  const late = drainWatchBroker(broker, 10_000, 2);
  const shared = drainWatchBroker(broker, 10_000, 1);
  assert.notEqual(late, first, "a later registration takes its own drain");
  assert.equal(sent.length, 2, "one request per covering drain");

  routeWatchBrokerMessage(broker, { drained: true, id: sent[0], unproven: [] });
  assert.equal(await first, true);
  assert.deepEqual(verdicts, ["1:proven"], "the first reply reaches A only");

  routeWatchBrokerMessage(broker, { drained: true, id: sent[1], unproven: [] });
  assert.equal(await late, true);
  assert.equal(await shared, true);
  assert.deepEqual(verdicts.sort(), ["1:proven", "1:proven", "2:proven"]);
  assert.equal(broker.drainScopes?.size ?? 0, 0, "every scope is released");
}
