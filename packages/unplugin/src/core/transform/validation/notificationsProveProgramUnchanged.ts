import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { TRANSFORM_CLOCK_REFERENCE_DIRECTORIES } from "../clock/TRANSFORM_CLOCK_REFERENCE_DIRECTORIES";
import { refreshFilesystemClockReference } from "../clock/refreshFilesystemClockReference";
import { isProjectWalkPath } from "../project/isProjectWalkPath";
import { notificationsProveMembership } from "../tracker/notificationsProveMembership";
import type { TtscGenerationProof } from "./TtscGenerationProof";
import { matchesUniversalHostInputs } from "./matchesUniversalHostInputs";

/**
 * Whether the generation's live notifications prove its program could not have
 * changed since capture (samchon/ttsc#1398).
 *
 * A module outside the program stays outside it until the program changes: a
 * config admits it, or an input starts importing it. Either one is an event the
 * generation's watchers report, a membership change, a content change of a
 * program input, or a changed universal input. While none has been reported and
 * every watcher can vouch for content, the out-of-program answer holds, and the
 * delivery skips the project walk it used to pay every time.
 *
 * @evidence contracts/common.md#principled-implementation Proven membership and healthy complete content notifications exclude program-input changes; universal validation separately qualifies configuration and plugin-source authority.
 * @evidence contracts/common.md#clear-and-simple-design One admission predicate composes membership, relevant tracker changes and universal proof for out-of-program deliveries.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed or omitted notification streams cannot prove unchanged state; unrelated project events are excluded only by compiler membership policy.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain out-of-program stability and relevant change categories before tags.
 * @evidence contracts/portability.md#os-neutral-implementation Actual watcher content authority, compiler membership policy and same-device clock references qualify native observations without OS-name-derived case rules.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Trackers and clock references belong to the generation owner; this predicate retains no history or resource.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Scans the three trackers' recorded changes until a relevant event. Each
 *   project event pays lexical policy checks and native lstat along its path;
 *   costs follow event count, path components and policy matching. Admission
 *   then refreshes the native clock probe and validates universal coverage,
 *   unresolved content/candidates and plugin environment/tree authority. A
 *   quiet stream does not make that delegated work constant or eliminate it.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Qualified current notification and universal authority permit sibling
 *   out-of-program deliveries to reuse the generation without another project
 *   walk. The predicate is recomputed against live flags and recorded events;
 *   it caches no boolean permission across a tracker or universal change.
 */
export function notificationsProveProgramUnchanged(
  /**
   * Generation supplying live tracker state, compiler policy and universal
   * proof.
   */
  cached: TtscCachedProjectTransform,
  proof?: TtscGenerationProof.Transaction,
): boolean {
  if (!notificationsProveMembership(cached)) return false;
  for (const tracker of [
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
    cached.candidateMutationTracker,
  ]) {
    if (tracker === undefined) continue;
    if (
      tracker.contentAuthoritative !== true ||
      tracker.membershipChanged ||
      tracker.changesOmitted
    ) {
      return false;
    }
    for (const changed of tracker.changes) {
      // The project observer also hears paths the walk never enters, such as
      // a package directory named like a source; only what the walk covers
      // can be a program input. Every other tracker's paths are inputs.
      if (
        tracker !== cached.projectMutationTracker ||
        isProjectWalkPath(
          cached.projectRoot,
          changed,
          undefined,
          resultFilesystem(cached.result),
          cached.membershipPolicy,
        )
      ) {
        return false;
      }
    }
  }
  if (
    cached.projectMutationTracker === undefined ||
    cached.hostInputValidation === undefined
  ) {
    return false;
  }
  // The universal inputs no tracker vouches for are proven by metadata, which
  // stands for content only against a reference minted since any rollback, as
  // every other delivery proof mints before it reads.
  refreshFilesystemClockReference(
    TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.get(cached),
    resultFilesystem(cached.result),
  );
  return matchesUniversalHostInputs(cached, cached.hostInputValidation, proof);
}
