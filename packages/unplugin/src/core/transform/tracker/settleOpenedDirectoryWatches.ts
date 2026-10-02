import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import type { TtscProjectMutationTracker } from "./TtscProjectMutationTracker";
import { WATCH_PROBE_TIMEOUT_MS } from "./broker/WATCH_PROBE_TIMEOUT_MS";
import { drainLinuxWatchHelper } from "./linux/drainLinuxWatchHelper";
import { usesLinuxWatchHelper } from "./linux/usesLinuxWatchHelper";

/**
 * Wait until every watch a tracker opened in this process is live, and give the
 * tracker the drain its backend needs (samchon/ttsc#1426).
 *
 * A watch in the Linux watch helper goes live only once the helper answers, and
 * hears nothing before that, so the tracker vouches for nothing until then. One
 * that could not go live fails the tracker, exactly as a watch that could not
 * be opened. Its drain is the helper's sync, which proves every event queued
 * before it has arrived; a `fs.watch` watch keeps draining on the next turn of
 * this loop. A helper that stops answering must not hold the capture, so a
 * watch still unanswered after a while fails the tracker too.
 *
 * @evidence contracts/common.md#principled-implementation
 *   All opening acknowledgments must hold; absent readiness belongs to an
 *   already-open synchronous backend, while false or timeout withdraws authority.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One readiness aggregate and one deadline select the verdict; native drainage
 *   is attached at the same backend boundary rather than guessed by consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The timeout marks failure, never success. No delayed watch is certified
 *   merely because a fixed amount of time elapsed.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain asynchronous opening, backend drainage and the
 *   deadline's failure meaning under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral coverage waits for each backend's explicit readiness and uses
 *   the native helper's supported sync barrier only when that helper owns watches.
 * @evidence contracts/performance.md#efficient-algorithms
 *   For n handles, one Promise.all scans n readiness values and races one timer;
 *   openings wait concurrently rather than accumulating per-watch deadlines.
 *   The input-promise array, aggregate reactions and resolved answer array use
 *   O(n) temporary references; the race adds a fixed pair of branches.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Existing readiness promises are reused, not new opening requests. This
 *   operation is called for one constructor's owned watcher set.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The aggregate owns one deadline timer and clears it on fulfillment or
 *   rejection; watcher handles remain tracker-owned until tracker.close.
 *   Timeout does not cancel already issued readiness promises. Their owning
 *   backend and tracker closure remain responsible for outstanding requests.
 */
export async function settleOpenedDirectoryWatches(
  tracker: TtscProjectMutationTracker,
  watchers: readonly { ready?: Promise<boolean> }[],
  filesystem: TtscTransformFilesystemOperations,
): Promise<void> {
  if (usesLinuxWatchHelper(filesystem)) tracker.drain = drainLinuxWatchHelper;
  let timer: NodeJS.Timeout | undefined;
  try {
    const live = await Promise.race([
      Promise.all(
        watchers.map((watcher) => watcher.ready ?? Promise.resolve(true)),
      ).then((answers) => !answers.includes(false)),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), WATCH_PROBE_TIMEOUT_MS);
      }),
    ]);
    if (!live) tracker.failed = true;
  } finally {
    clearTimeout(timer);
  }
}
