import type { TtscProjectDirectorySnapshot } from "../project/TtscProjectDirectorySnapshot";

/** Compare two deterministic project-directory membership snapshots. */
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
