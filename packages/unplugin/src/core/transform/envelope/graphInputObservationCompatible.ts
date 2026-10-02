import type { ITtscCompilerTransformation } from "ttsc";

/**
 * Whether normalized predicates can describe one stable filesystem state.
 *
 * Nonempty directory entries establish directory presence, but empty entries
 * and failed reads establish neither presence nor absence. Unqueried predicates
 * remain unknown; this check compares recorded results without probing the host.
 *
 * @evidence contracts/common.md#principled-implementation Successful reads require file-compatible predicates, nonempty listings require directory-compatible predicates, and explicit stat kinds rule out conflicting existence results; unknown and failed-read values are not treated as absence.
 * @evidence contracts/common.md#clear-and-simple-design Explicit contradiction checks compare one normalized record without combining schema parsing, host observation or legacy encoding in the same predicate.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed reads and empty listings retain their weaker meaning rather than gaining synthetic existence facts to make a proof acceptable.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the normalized-input premise and the weaker meaning of failed reads, empty lists and unqueried operations; paragraph/tag separation follows the documentation skill.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Compares recorded predicate results in memory; it probes no filesystem and parses no path.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function graphInputObservationCompatible(
  observation: ITtscCompilerTransformation.IInputObservation,
): boolean {
  const { accessibleEntries, directoryExists, fileExists, readFile, stat } =
    observation;
  const hasAccessibleEntries =
    accessibleEntries !== undefined &&
    (accessibleEntries.directories.length !== 0 ||
      accessibleEntries.files.length !== 0);
  if (
    hasAccessibleEntries &&
    (fileExists === true ||
      directoryExists === false ||
      (stat !== undefined && stat !== "directory") ||
      readFile?.ok === true)
  ) {
    return false;
  }
  if (fileExists === true && directoryExists === true) return false;
  if (
    stat === "directory" &&
    (fileExists === true || directoryExists === false)
  ) {
    return false;
  }
  if (stat === "file" && (fileExists === false || directoryExists === true)) {
    return false;
  }
  if (stat === "missing" && (fileExists === true || directoryExists === true)) {
    return false;
  }
  if (
    readFile?.ok === true &&
    (fileExists === false ||
      directoryExists === true ||
      (stat !== undefined && stat !== "file"))
  ) {
    return false;
  }
  return true;
}
