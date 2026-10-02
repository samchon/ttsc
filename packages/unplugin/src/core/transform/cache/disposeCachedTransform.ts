import { TRANSFORM_CLOCK_REFERENCE_DIRECTORIES } from "../clock/TRANSFORM_CLOCK_REFERENCE_DIRECTORIES";
import { disposeFilesystemClockReference } from "../clock/disposeFilesystemClockReference";
import type { TtscCachedProjectTransform } from "./TtscCachedProjectTransform";

/**
 * Release one generation's watchers and retained clock probe exactly once.
 *
 * @evidence contracts/common.md#principled-implementation Removing handles from the generation before closing makes repeated disposal harmless; each independent tracker is attempted even if another close throws.
 * @evidence contracts/common.md#clear-and-simple-design The disposer owns the three tracker fields and clock reference only, leaving cache membership and lifecycle scheduling to their callers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Catching a close failure preserves independent cleanup, without turning a failed compile or validation into a successful result.
 * @evidence contracts/common.md#meaningful-documentation The native comment identifies generation ownership, and the internal explanation states why scheduled cleanup must not leave rejected promises.
 * @evidence contracts/performance.md#efficient-algorithms Disposal visits three trackers and one clock reference; delegated tracker cleanup closes W retained watchers in O(W) work and temporary references, without rescanning project files.
 * @evidence contracts/performance.md#reuse-equivalent-work One disposer handles eviction and complete reset, avoiding divergent lifetime rules.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Handles and the clock association are detached before cleanup; every independent resource is attempted and repeated disposal owns no remaining handle.
 */
export function disposeCachedTransform(
  cached: TtscCachedProjectTransform,
): void {
  const trackers = [
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
    cached.candidateMutationTracker,
  ];
  cached.projectMutationTracker = undefined;
  cached.hostInputMutationTracker = undefined;
  cached.candidateMutationTracker = undefined;
  const clockReferenceDirectory =
    TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.get(cached);
  TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.delete(cached);
  for (const tracker of trackers) {
    try {
      tracker?.close();
    } catch {
      // Disposal is scheduled behind fulfilled generation Promises, so it has
      // no caller that can recover from a close failure. Keep releasing every
      // independent resource and leave no rejected cleanup Promise behind.
    }
  }
  if (clockReferenceDirectory !== undefined) {
    disposeFilesystemClockReference(clockReferenceDirectory);
  }
}
