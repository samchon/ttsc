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
 * @evidence contracts/common.md#principled-implementation
 *   An id-bound acknowledgment certifies queue ordering; timeout or submission
 *   failure resolves false and cannot authorize reuse from silence.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One idempotent release handles replies, failure and timeout; the synchronous
 *   callback preserves line order for joining observers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The deadline bounds waiting, not proof. No guessed sleep is treated as a
 *   native acknowledgment and no observer is enabled by promise timing alone.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs and parameter comments distinguish queue proof, deadline
 *   and synchronous callback order under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral callers rely on the helper's protocol acknowledgment rather than
 *   assuming platform-name or clock delay proves native events delivered.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One request and one expected-constant map entry use constant bookkeeping;
 *   helper queue cost belongs to the native sync owner.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Tracker settle shares equivalent in-flight barriers above this primitive;
 *   independent calls need their own queue position and synchronous callback.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   A request owns one timer, map entry and helper reference until acknowledgment,
 *   failed submission, helper termination or the one-second deadline releases it.
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
