/**
 * A directory watched on behalf of the pattern that named it.
 *
 * @evidence contracts/common.md#principled-implementation The absolute root and descent flag identify the conservative tree population needed to notice a declared pattern changing.
 * @evidence contracts/common.md#clear-and-simple-design A directory watch contains only its native root and traversal choice; resolved files remain in the separate file list.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The depth decision follows wildcard path structure rather than an arbitrary maximum documentation depth.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the recursive distinction and why a bare filename wildcard does not require a repository-wide scan.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
export interface IArtifactDirectory {
  /** Absolute path of the directory to walk. */
  path: string;

  /**
   * Whether the walk descends.
   *
   * Taken from wildcard path structure rather than assumed, because assuming it
   * is expensive in exactly the case that looks harmless: a rule declaring
   * `*.md` has the project root for its fixed prefix, and treating that as
   * recursive would state every file in the repository before every graph
   * request.
   */
  recursive: boolean;
}
