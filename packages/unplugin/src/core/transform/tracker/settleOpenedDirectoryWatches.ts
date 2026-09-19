import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import type { TtscProjectMutationTracker } from "./TtscProjectMutationTracker";
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
 */
export async function settleOpenedDirectoryWatches(
  tracker: TtscProjectMutationTracker,
  watchers: readonly { ready?: Promise<boolean> }[],
  filesystem: TtscTransformFilesystemOperations,
): Promise<void> {
  if (usesLinuxWatchHelper(filesystem)) tracker.drain = drainLinuxWatchHelper;
  let timer: NodeJS.Timeout | undefined;
  const live = await Promise.race([
    Promise.all(
      watchers.map((watcher) => watcher.ready ?? Promise.resolve(true)),
    ).then((answers) => !answers.includes(false)),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), WATCH_READY_TIMEOUT_MS);
    }),
  ]);
  clearTimeout(timer);
  if (!live) tracker.failed = true;
}

/** How long a tracker waits for its watches to go live. */
const WATCH_READY_TIMEOUT_MS = 10_000;
