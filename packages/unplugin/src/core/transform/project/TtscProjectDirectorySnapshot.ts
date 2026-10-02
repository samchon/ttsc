/**
 * One directory's project-membership identity at generation time.
 *
 * @evidence contracts/common.md#principled-implementation The lexical directory address, subtree relevance and filtered-entry signature distinguish membership meaning from metadata changes caused by irrelevant emitted files.
 * @evidence contracts/common.md#clear-and-simple-design Three fields carry the walk's result without duplicating its traversal or invalidation policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Relevance follows admitted input kinds and the resolved membership policy rather than an expanding list of fixture or output-directory names.
 * @evidence contracts/common.md#meaningful-documentation Field paragraphs explain why irrelevant directories remain watched and why filtered membership, rather than a directory timestamp, is compared.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   TtscProjectDirectorySnapshot only declares a shape; it has no filesystem,
 *   path or process operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscProjectDirectorySnapshot only declares a shape; it has no computation
 *   at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscProjectDirectorySnapshot only declares a shape; it has no work to
 *   reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscProjectDirectorySnapshot only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface TtscProjectDirectorySnapshot {
  /** Absolute directory spelling used by the project walk. */
  path: string;

  /**
   * Whether this directory's subtree can hold a program input.
   *
   * A directory that cannot is still walked and still watched, so a source
   * appearing in it later is noticed, but it takes no part in the membership
   * comparison. That is what lets a bundler create its output directory and
   * fill it without voiding a generation no compiler input touched, for any
   * output directory rather than for fifteen names (samchon/ttsc#1307).
   */
  relevant: boolean;

  /**
   * Digest of the entries the walk itself considers: every immediate child the
   * ignore list does not drop, with its kind.
   *
   * Deliberately not the directory's own metadata. A directory's stamp moves
   * whenever _any_ entry is added or removed, including the ones the walk
   * exists to ignore, so a bundler emitting into `dist/` — or merely creating
   * that directory for the first time — moved the project root's stamp and
   * voided a generation that no compiler input had touched. The ignore list
   * only protects the generation if the membership proof honours it too.
   */
  signature: string;
}
