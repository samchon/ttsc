/**
 * Whether a project-walk snapshot is coherent for the inputs that matter.
 *
 * A capturing walk reads admitted regular files, including source artifacts
 * that no compiled input consumed. Such a file can fail its own bracketed read
 * while every declared input holds still. A validating walk may already limit
 * those reads to declared keys. Attributable failure outside that population
 * does not establish that the generation changed. A walk that could not
 * enumerate a directory, or a file-level failure this snapshot could not
 * attribute to a key, still taints everything: neither can be shown to leave
 * the inputs alone.
 *
 * @evidence contracts/common.md#principled-implementation Global directory incompleteness taints all inputs, while attributable unstable files taint a declared generation only when their keys belong to its required population.
 * @evidence contracts/common.md#clear-and-simple-design One predicate separates enumeration coherence from file-level coherence without duplicating the filesystem walk.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown enumeration failures cannot be ignored as unrelated artifacts, and irrelevant file failures cannot invent a program inconsistency.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain global enumeration failure and attributable non-input instability as distinct states.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Reads completeness flags and key sets of an already collected snapshot; it reads no filesystem.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate borrows the snapshot and retains no storage or native resource.
 * @evidence contracts/performance.md#efficient-algorithms Global flags precede one unstable-key scan with expected-constant Set entry lookup and early mismatch return; hashing or comparing a newly queried key retains its text cost. The predicate builds no secondary key collection.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The owning generation validator coordinates reused snapshots; this helper classifies one walk's authority.
 */
export function walkSnapshotComplete(
  snapshot: {
    /** Whether all selected directory and file observations were coherent. */
    complete: boolean;

    /** Whether enumeration and attribution establish every directory boundary. */
    directoryComplete: boolean;

    /** Project identity keys attributed to failed or unstable file observations. */
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
