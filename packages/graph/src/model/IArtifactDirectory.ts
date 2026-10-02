/**
 * A directory watched on behalf of the pattern that named it.
 *
 * @evidence contracts/common.md#principled-implementation The absolute root and descent flag identify the conservative tree population needed to notice a declared pattern changing.
 * @evidence contracts/common.md#clear-and-simple-design A directory watch contains only its native root and traversal choice; resolved files remain in the separate file list.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The depth decision follows wildcard path structure rather than an arbitrary maximum documentation depth.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the recursive distinction and why a bare filename wildcard does not require a repository-wide scan.
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
