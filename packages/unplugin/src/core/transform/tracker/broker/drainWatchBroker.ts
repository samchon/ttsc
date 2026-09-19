import type { WatchBroker } from "./WatchBroker";

/**
 * Ask the watch broker to acknowledge, and resolve with whether it did.
 *
 * The child answers after a turn of its own loop, so a watch callback it had
 * already queued has run, and the ordered IPC channel puts every message it
 * sent before the reply ahead of the reply. That is the same proof an
 * in-process watcher gets from a macrotask turn, rather than the fixed wait
 * this replaces, which guessed at the crossing (samchon/ttsc#1272).
 *
 * A broker that never answers must not hold a delivery, so the wait gives up
 * after a while. It resolves `false` then, and when the broker dies, since an
 * event may still be in flight: the caller must not read the trackers' silence
 * as proof (samchon/ttsc#1428). It used to give up after 10 ms and resolve as
 * if answered, so a busy host or a child forwarding a burst lost the edit a
 * delivery was about to serve.
 */
export function drainWatchBroker(broker: WatchBroker): Promise<boolean> {
  // Every tracker of a generation lives in one broker, so one acknowledgement
  // answers for all of them. Sharing the in-flight round-trip keeps a settle to
  // a single crossing.
  broker.draining ??= startWatchBrokerDrain(broker).finally(() => {
    broker.draining = undefined;
  });
  return broker.draining;
}

function startWatchBrokerDrain(broker: WatchBroker): Promise<boolean> {
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
    const timer = setTimeout(
      () => release(false),
      WATCH_BROKER_DRAIN_FALLBACK_MS,
    );
    broker.drains.set(id, release);
    if (broker.child.send?.({ id, op: "drain" }) !== true) {
      release(false);
    }
  });
}

/**
 * How long a drain waits for the broker. A healthy child answers within a
 * millisecond; this only bounds the wait on one that stopped answering, and
 * missing it now costs a validation rather than a stale delivery.
 */
const WATCH_BROKER_DRAIN_FALLBACK_MS = 1_000;
