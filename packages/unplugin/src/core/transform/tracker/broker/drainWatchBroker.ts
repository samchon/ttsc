import { WATCH_PROBE_TIMEOUT_MS } from "./WATCH_PROBE_TIMEOUT_MS";
import type { WatchBroker } from "./WatchBroker";

/**
 * Ask the watch broker to acknowledge, and resolve with whether it did.
 *
 * The child answers after a turn of its own loop, so a watch callback it had
 * already queued has run, and the ordered IPC channel puts every message it
 * sent before the reply ahead of the reply. That is the same proof an
 * in-process watcher gets from a macrotask turn, rather than the fixed wait
 * this replaces, which guessed at the crossing (samchon/ttsc#1272). On macOS
 * the child answers once each stream it can prove has delivered a probe, which
 * takes the service's latency (samchon/ttsc#1453).
 *
 * A broker that never answers must not hold a delivery, so the wait gives up
 * after twice the probe timeout: the child itself gives up on a stream that
 * does not deliver within one, and answers then, so only a child that is stuck
 * or gone runs out the second. It resolves `false` then, and when the broker
 * dies, since an event may still be in flight: the caller must not read the
 * trackers' silence as proof (samchon/ttsc#1428). It used to give up after 10
 * ms and resolve as if answered, so a busy host or a child forwarding a burst
 * lost the edit a delivery was about to serve.
 *
 * @param timeout How long to wait for the reply; the default is what the child
 *   is given plus the same again, and a test of the wait itself passes less.
 */
export function drainWatchBroker(
  broker: WatchBroker,
  timeout: number = 2 * WATCH_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  // Every tracker of a generation lives in one broker, so one acknowledgement
  // answers for all of them. Sharing the in-flight round-trip keeps a settle to
  // a single crossing.
  broker.draining ??= startWatchBrokerDrain(broker, timeout).finally(() => {
    broker.draining = undefined;
  });
  return broker.draining;
}

function startWatchBrokerDrain(
  broker: WatchBroker,
  timeout: number,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const id = broker.nextId++;
    let settled = false;
    const release = (answered: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      broker.drains.delete(id);
      broker.pendingDrains -= 1;
      if (broker.pendingDrains === 0 && broker.pendingRegistrations === 0) {
        broker.child.unref();
        broker.child.channel?.unref?.();
      }
      resolve(answered);
    };
    // Hold the channel open while the acknowledgement is outstanding. The
    // broker is unreferenced between requests so it never keeps a host alive,
    // and a reply is the only thing this promise can be resolved by: without
    // the reference the loop can empty while a delivery waits here, and the
    // process exits mid-build with nothing to report.
    broker.pendingDrains += 1;
    broker.child.ref();
    broker.child.channel?.ref?.();
    const timer = setTimeout(() => release(false), timeout);
    broker.drains.set(id, release);
    if (broker.child.send?.({ id, op: "drain" }) !== true) {
      release(false);
    }
  });
}
