import { TRANSFORM_CLOCK_REFERENCE_DIRECTORIES } from "../clock/TRANSFORM_CLOCK_REFERENCE_DIRECTORIES";
import { disposeFilesystemClockReference } from "../clock/disposeFilesystemClockReference";
import type { TtscCachedProjectTransform } from "./TtscCachedProjectTransform";

/** Release one generation's watchers and retained clock probe exactly once. */
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
