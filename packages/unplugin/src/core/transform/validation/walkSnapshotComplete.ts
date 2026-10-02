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
 *
 * @evidence contracts/common.md#principled-implementation Global directory incompleteness taints all inputs, while attributable unstable files taint a declared generation only when their keys belong to its required population.
 * @evidence contracts/common.md#clear-and-simple-design One predicate separates enumeration coherence from file-level coherence without duplicating the filesystem walk.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown enumeration failures cannot be ignored as unrelated artifacts, and irrelevant file failures cannot invent a program inconsistency.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain global enumeration failure and attributable non-input instability as distinct states.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Reads completeness flags and key sets of an already collected snapshot; it reads no filesystem.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate borrows the snapshot and retains no storage or native resource.
 * @evidence contracts/performance.md#efficient-algorithms Constant-time global checks precede one unstable-key scan with set membership and early mismatch return.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The owning generation validator coordinates reused snapshots; this helper classifies one walk's authority.
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
