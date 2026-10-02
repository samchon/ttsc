import path from "node:path";

import { pathIsWithin } from "../filesystem/pathIsWithin";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";

/**
 * Whether a healthy notification scope proves one exact input unchanged: the
 * tracker is live, its silence is proven, the input is one it watches by name,
 * the watch below which the input lives was proven to deliver, and no event
 * touched the input.
 *
 * @evidence contracts/common.md#principled-implementation Verified healthy content authority, exact covered spelling and no overlapping unproven scope or event establish this input's notification witness.
 * @evidence contracts/common.md#clear-and-simple-design One shared predicate supplies universal and derived-input validators with the same notification authority rule.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Quiet but failed, incomplete or undeliverable scopes are rejected rather than promoted to proof.
 * @evidence contracts/common.md#meaningful-documentation Native prose enumerates health, coverage and overlap premises rather than treating silence as universal authority.
 * @evidence contracts/portability.md#os-neutral-implementation Native lexical resolution and supplied overlap semantics qualify paths; fallback containment is component-aware rather than substring matching.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Scans the unproven directories once and the changes once, in sequence
 *   rather than nested.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function trackerProvesInputUnchanged(
  tracker: TtscProjectMutationTracker | undefined,
  input: string,
): boolean {
  if (
    tracker === undefined ||
    tracker.failed ||
    tracker.unverified === true ||
    tracker.changesOmitted
  ) {
    return false;
  }
  if (tracker.contentAuthoritative !== true) return false;
  const absolute = path.resolve(input);
  if (tracker.covered?.has(absolute) !== true) return false;
  // The watch below which the input lives could not prove it delivered, so
  // its silence says nothing about this input (samchon/ttsc#1453).
  for (const directory of tracker.unproven ?? []) {
    if (
      tracker.overlaps?.(absolute, directory) ??
      (pathIsWithin(absolute, directory) || pathIsWithin(directory, absolute))
    ) {
      return false;
    }
  }
  for (const changed of tracker.changes) {
    if (
      tracker.overlaps?.(absolute, changed) ??
      (pathIsWithin(absolute, changed) || pathIsWithin(changed, absolute))
    ) {
      return false;
    }
  }
  return true;
}
