import path from "node:path";

/**
 * Absolutize one graph string list (`globals`, `configs`), skipping members a
 * malformed envelope section may carry. Duplicates survive; the caller
 * deduplicates the merged list.
 *
 * @evidence contracts/common.md#principled-implementation Nonempty strings resolve against the project root in list order; malformed entries have no path meaning, and preserving duplicates leaves cross-category equivalence to the final merger.
 * @evidence contracts/common.md#clear-and-simple-design One list adapter normalizes producer paths without mixing graph ownership, alias deduplication or watcher acquisition into an elementary boundary operation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Validation follows the supported string-list shape rather than accepting guessed values or special filenames; the function does not mutate the producer list.
 * @evidence contracts/common.md#meaningful-documentation Native prose names the graph-list use, malformed-member handling and duplicate ownership, with a blank line before acknowledgments following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve preserves absolute paths and interprets relative members using the host's path semantics instead of manually joining separators or folding case.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Scans every array member, including malformed members, and resolves each
 *   nonempty string once. Cost includes native root/entry path text; the returned
 *   array retains accepted entries and resolved path text, including duplicates.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function selectListedFiles(
  projectRoot: string,
  listed: unknown,
): string[] {
  if (!Array.isArray(listed)) {
    return [];
  }
  const output: string[] = [];
  for (const entry of listed) {
    if (typeof entry !== "string" || entry.length === 0) {
      continue;
    }
    output.push(path.resolve(projectRoot, entry));
  }
  return output;
}
