/**
 * Whether a project-walk snapshot is coherent for the inputs that matter.
 *
 * The walk reads every file under the project root, so a file nothing compiled
 * (a log being appended, a coverage report being written, a generated artifact
 * being replaced) can fail its own read sandwich while every input holds still.
 * That is not evidence about the generation, and treating it as such costs a
 * whole-project recompile per delivered module. A walk that could not enumerate
 * a directory, or a file-level failure this snapshot could not attribute to a
 * key, still taints everything: neither can be shown to leave the inputs
 * alone.
 */
export function walkSnapshotComplete(
  snapshot: {
    complete: boolean;
    directoryComplete: boolean;
    unstableFiles: ReadonlySet<string>;
  },
  declared: ReadonlySet<string> | undefined,
): boolean {
  if (declared === undefined) {
    return snapshot.complete;
  }
  if (!snapshot.directoryComplete) {
    return false;
  }
  for (const key of snapshot.unstableFiles) {
    if (declared.has(key)) return false;
  }
  return true;
}
