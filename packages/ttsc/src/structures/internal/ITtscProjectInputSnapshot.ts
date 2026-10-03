/**
 * Normalized local filesystem dependencies published by project rules.
 *
 * @evidence contracts/common.md#principled-implementation Exact paths, glob populations and selection-reload inputs have distinct roles; declared spellings accompany physical identities so link retargeting remains observable instead of being lost during normalization.
 * @evidence contracts/common.md#clear-and-simple-design One snapshot exposes normalized comparison inputs and optional pre-normalization watch inputs, keeping filesystem publication separate from watcher installation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing exact paths remain meaningful candidates; consumers do not replace them with a fabricated present-file list or compensate for lost symlink spellings.
 * @evidence contracts/common.md#meaningful-documentation Native comments explain missing paths, slash glob vocabulary, reload scope and why declared spellings are retained; paragraph, member and tag spacing follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native exact paths and forward-slash glob patterns are distinct vocabularies. Normalization uses observed realpath prefixes and filesystem case policy, preserving unresolved spelling when evidence is unavailable. Retained pre-identity spellings let consumers consider link/junction replacement attention; the value itself certifies neither complete alias resolution nor installed watcher behavior.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
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

  /** Selected root identity, with unresolved spelling where proof is absent. */
  root: string;

  /**
   * The spellings the contributors published, before identity normalization.
   *
   * Successful realpath observations can replace a link spelling with its
   * target; missing or unavailable suffixes retain unresolved spelling. The
   * merger retains absolute lexical spellings when they differ from normalized
   * identity lists, so watcher consumers can consider both target changes and
   * replacement attention at a declared link. These lists do not install or
   * certify watcher delivery by themselves.
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
