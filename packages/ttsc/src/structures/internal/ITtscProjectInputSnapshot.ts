/** Normalized local filesystem dependencies published by project rules. */
export interface ITtscProjectInputSnapshot {
  /** Exact absolute paths, retained even while missing. */
  files: readonly string[];
  /** Absolute glob patterns using forward-slash separators. */
  globs: readonly string[];
  /** Exact paths whose change invalidates plugin/execution selection. */
  reloadFiles?: readonly string[];
  /** Directories whose immediate topology changes execution selection. */
  reloadDirectories?: readonly string[];
  /** Physical project root that anchored relative declarations. */
  root: string;
  /**
   * The spellings the contributors published, before identity normalization.
   *
   * Normalizing a declaration resolves it through every symlink on its way, so
   * the retained snapshot names the file the link currently points at rather
   * than the link. That is what every comparison needs and the wrong thing to
   * watch: retargeting or replacing the link is exactly what decides which
   * bytes the declaration names next, and it happens at the spelling that
   * normalization discarded. Consumers that install watchers keep both.
   */
  declared?: {
    files: readonly string[];
    globs: readonly string[];
    reloadFiles?: readonly string[];
    reloadDirectories?: readonly string[];
  };
}
