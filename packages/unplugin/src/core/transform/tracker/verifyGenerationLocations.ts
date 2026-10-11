import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";

/**
 * Recheck every watched directory's identity against the one its tracker opened
 * on, returning what the check read.
 *
 * A watch that now observes a replaced directory has nothing left to say about
 * the new one, so its tracker gives up its authority before anything reads it.
 * The trackers share what they read, so a directory they all watch, the project
 * root above all, costs one metadata call per delivery rather than one per
 * tracker. The returned readings belong to the synchronous admission that ran
 * the check: a validator in it that must know whether one of these directories
 * is still a directory reads the answer here instead of stating it again
 * (samchon/ttsc#1735). The map assumes the callbacks share a coherent
 * filesystem view; it is not an atomic snapshot.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Each verifier compares followed device and file ids with the opened ones,
 *   and a mismatch or unreadable location withdraws its tracker.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One three-tracker list drives every verifier through one delivery-local
 *   identity map, which is also the result.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   A replaced watched directory withdraws authority; lexical spelling never
 *   proves a directory unchanged.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains withdrawal, sharing and the result's synchronous
 *   lifetime under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Identities are the filesystem's own physical identities, followed through
 *   links, with no platform case rule.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Three tracker slots are visited; existing verifiers scan their retained
 *   watched locations, sharing one metadata read per exact directory spelling.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The map is created for each admission and handed to that admission's
 *   validators, never retained across deliveries.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The caller's synchronous transaction owns the map, which retains queried
 *   directory and identity text only until that transaction ends.
 */
export function verifyGenerationLocations(
  cached: TtscCachedProjectTransform,
): Map<string, string | undefined> {
  const seen = new Map<string, string | undefined>();
  for (const tracker of [
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
    cached.candidateMutationTracker,
  ])
    tracker?.verifyLocations?.(seen);
  return seen;
}
