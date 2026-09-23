import type { LinuxWatchHelper } from "./LinuxWatchHelper";
import { referenceLinuxWatchHelper } from "./referenceLinuxWatchHelper";
import { sendLinuxWatchHelper } from "./sendLinuxWatchHelper";

/**
 * Ask the Linux watch helper to read its instance empty, and resolve with
 * whether it answered (samchon/ttsc#1426).
 *
 * The kernel queues an event before the write that caused it returns, and the
 * helper answers only after reading its queue empty and writing every event
 * ahead of the answer. An answered sync therefore proves every edit made before
 * it has reached its subscriptions. An unanswered one proves nothing
 * (samchon/ttsc#1428), and gives up after a second, so a helper that stopped
 * answering cannot hold a delivery.
 *
 * @param helper The helper to sync.
 * @param onAnswer Told whether the helper answered, synchronously with the
 *   answer's line, before any later line is routed. A resolution reaches its
 *   callbacks only after every line the same chunk of output carried, so a
 *   caller that must act between the answer and the next event, as a subscriber
 *   joining a shared watch does (`subscribeLinuxDirectoryWatch`), acts here.
 */
export function syncLinuxWatchHelper(
  helper: LinuxWatchHelper,
  onAnswer?: (answered: boolean) => void,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const id = helper.nextId++;
    let settled = false;
    const release = (answered: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (helper.syncs.delete(id)) referenceLinuxWatchHelper(helper, -1);
      onAnswer?.(answered);
      resolve(answered);
    };
    const timer = setTimeout(() => release(false), SYNC_FALLBACK_MS);
    helper.syncs.set(id, release);
    referenceLinuxWatchHelper(helper, 1);
    if (!sendLinuxWatchHelper(helper, { id, op: "sync" })) release(false);
  });
}

/** How long a sync waits for a helper that stopped answering. */
const SYNC_FALLBACK_MS = 1_000;
