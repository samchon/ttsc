import type { WindowsProjectMutationBroker } from "./WindowsProjectMutationBroker";

/**
 * Ask the Windows broker to acknowledge, and resolve when it does.
 *
 * The child answers after a turn of its own loop, so a watch callback it had
 * already queued has run, and the ordered IPC channel puts every message it
 * sent before the reply ahead of the reply. That is the same proof an
 * in-process watcher gets from a macrotask turn, rather than the fixed wait
 * this replaces, which guessed at the crossing (samchon/ttsc#1272).
 *
 * A broker that never answers must not hold a delivery: the wait falls back to
 * the previous fixed grace, after which validation proceeds against whatever
 * the tracker knows, exactly as it did before.
 */
export function drainWindowsProjectMutationBroker(
  broker: WindowsProjectMutationBroker,
): Promise<void> {
  // Every tracker of a generation lives in one broker, so one acknowledgement
  // answers for all of them. Sharing the in-flight round-trip keeps a settle to
  // a single crossing.
  broker.draining ??= startWindowsProjectMutationDrain(broker).finally(() => {
    broker.draining = undefined;
  });
  return broker.draining;
}

function startWindowsProjectMutationDrain(
  broker: WindowsProjectMutationBroker,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const id = broker.nextId++;
    let settled = false;
    const release = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      broker.drains.delete(id);
      broker.pendingDrains -= 1;
      if (broker.pendingDrains === 0 && broker.pendingRegistrations === 0) {
        broker.child.unref();
        broker.child.channel?.unref?.();
      }
      resolve();
    };
    // Hold the channel open while the acknowledgement is outstanding. The
    // broker is unreferenced between requests so it never keeps a host alive,
    // and a reply is the only thing this promise can be resolved by: without
    // the reference the loop can empty while a delivery waits here, and the
    // process exits mid-build with nothing to report.
    broker.pendingDrains += 1;
    broker.child.ref();
    broker.child.channel?.ref?.();
    const timer = setTimeout(release, WINDOWS_MUTATION_DRAIN_FALLBACK_MS);
    broker.drains.set(id, release);
    if (broker.child.send?.({ id, op: "drain" }) !== true) {
      release();
    }
  });
}

/** The wait a broker that stopped answering degrades to. */
const WINDOWS_MUTATION_DRAIN_FALLBACK_MS = 10;
