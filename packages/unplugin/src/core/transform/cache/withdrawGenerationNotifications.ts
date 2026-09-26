import type { TtscCachedProjectTransform } from "./TtscCachedProjectTransform";

/**
 * Close a generation's retained watchers and stop it relying on them.
 *
 * Validation lets a retained watcher's silence stand in for re-reading inputs.
 * When the host's watch policy stops justifying that, the watchers are closed
 * and detached, and every later validation of the generation takes the path a
 * generation whose watchers never opened already takes: its recorded snapshot.
 * The clock reference and the generation itself stay, so an unchanged project
 * keeps its compile.
 */
export function withdrawGenerationNotifications(
  cached: TtscCachedProjectTransform,
): void {
  const trackers = [
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
    cached.candidateMutationTracker,
  ];
  if (trackers.every((tracker) => tracker === undefined)) return;
  cached.projectMutationTracker = undefined;
  cached.hostInputMutationTracker = undefined;
  cached.candidateMutationTracker = undefined;
  for (const tracker of trackers) {
    try {
      tracker?.close();
    } catch {
      // The generation no longer reads the tracker, so a close failure leaves
      // nothing it could serve stale.
    }
  }
}
