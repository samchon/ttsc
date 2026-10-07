/**
 * One directory's project-membership identity at generation time.
 *
 * @evidence contracts/common.md#principled-implementation The lexical directory address, current admitted-file subtree relevance and filtered-entry signature distinguish membership meaning from metadata changes caused by irrelevant emitted files.
 * @evidence contracts/common.md#clear-and-simple-design Three fields carry the walk's result without duplicating its traversal or invalidation policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Relevance follows admitted input kinds and the resolved membership policy rather than an expanding list of fixture or output-directory names.
 * @evidence contracts/common.md#meaningful-documentation Field paragraphs explain why irrelevant directories remain watched and why filtered membership, rather than a directory timestamp, is compared.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The path member preserves the absolute native directory spelling used
 *   by one project's walk. Signatures describe its observed entry names and
 *   kinds; native platform and compiler admission policy belong to that walk.
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
   * Whether this directory's subtree currently contains an admitted regular
   * file.
   *
   * An admitted directory with no such file is still walked and watched, so a
   * source appearing in it later is noticed, but it takes no part in the
   * membership comparison. That is what lets a bundler create its output
   * directory and fill it without voiding a generation no compiler input
   * touched, for any output directory rather than for a fixed list of names.
   */
  relevant: boolean;

  /**
   * Digest of admitted, possible immediate entries and their kinds. A child
   * directory contributes only when its subtree currently has an admitted
   * regular file; an unstable enumeration carries a failure marker instead.
   *
   * Deliberately not the directory's own metadata. A directory's stamp moves
   * whenever _any_ entry is added or removed, including the ones the walk
   * exists to ignore. Comparing filtered membership avoids invalidation from
   * unrelated output-directory creation or writes.
   */
  signature: string;
}
