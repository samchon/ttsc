/**
 * Normalized local filesystem dependencies published by project rules.
 *
 * @evidence contracts/common.md#principled-implementation Exact paths, glob populations and selection-reload inputs have distinct roles; declared spellings accompany physical identities so link retargeting remains observable instead of being lost during normalization.
 * @evidence contracts/common.md#clear-and-simple-design One snapshot exposes normalized comparison inputs and optional pre-normalization watch inputs, keeping filesystem publication separate from watcher installation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing exact paths remain meaningful candidates; consumers do not replace them with a fabricated present-file list or compensate for lost symlink spellings.
 * @evidence contracts/common.md#meaningful-documentation Native comments explain missing paths, slash glob vocabulary, reload scope and why declared spellings are retained; paragraph, member and tag spacing follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native exact paths and the declared forward-slash glob grammar are distinct vocabularies; retaining original spellings alongside physical identities supports link/junction replacement watchers without assuming case sensitivity from the OS name.
 */
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
    /** Original exact-path spellings, including absent candidates. */
    files: readonly string[];

    /** Original glob spellings before physical-identity normalization. */
    globs: readonly string[];

    /** Original exact inputs that alter execution selection. */
    reloadFiles?: readonly string[];

    /** Original directory inputs that alter execution selection. */
    reloadDirectories?: readonly string[];
  };
}
