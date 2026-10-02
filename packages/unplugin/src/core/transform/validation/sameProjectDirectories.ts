import type { TtscProjectDirectorySnapshot } from "../project/TtscProjectDirectorySnapshot";

/**
 * Compare directory signatures relevant to either generation snapshot.
 *
 * Directories irrelevant on both sides cannot change program membership.
 * Gaining or losing relevance remains visible from the side where it matters.
 *
 * @evidence contracts/common.md#principled-implementation The union of relevant directory paths compares membership signatures on both sides, preserving entry and exit from the program's relevant population.
 * @evidence contracts/common.md#clear-and-simple-design One equality helper compares already deterministic snapshots without rediscovering compiler membership policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Relevance is supplied by the actual walk policy; unrelated output churn is not used to invalidate a generation.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains both-sided relevance and why ignored-on-both directories cannot affect this proof.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Compares directory signatures by recorded path string; the strings were produced by the same walk, and no filesystem is read.
 */
export function sameProjectDirectories(
  left: readonly TtscProjectDirectorySnapshot[],
  right: readonly TtscProjectDirectorySnapshot[],
): boolean {
  // Compare only the directories that can hold program inputs, on either side.
  // A directory irrelevant on both is not part of the program's membership at
  // all, so its appearance, disappearance or churn says nothing: that is a
  // bundler's output tree. One that gained or lost relevance is present in the
  // comparison from the side where it counts, and so is caught.
  const select = (
    snapshots: readonly TtscProjectDirectorySnapshot[],
  ): Map<string, TtscProjectDirectorySnapshot> =>
    new Map(
      snapshots
        .filter((directory) => directory.relevant)
        .map((directory) => [directory.path, directory]),
    );
  const leftRelevant = select(left);
  const rightRelevant = select(right);
  const paths = new Set([...leftRelevant.keys(), ...rightRelevant.keys()]);
  for (const location of paths) {
    if (
      leftRelevant.get(location)?.signature !==
      rightRelevant.get(location)?.signature
    ) {
      return false;
    }
  }
  return true;
}
