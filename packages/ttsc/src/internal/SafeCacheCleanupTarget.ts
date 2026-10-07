/**
 * One cache location authorized by a completed cleanup plan.
 *
 * Produced by {@link resolveSafeCacheCleanupTargets} only after every requested
 * directory has been resolved and checked, so a caller that removes `path` for
 * each target uses the resolver's root/project protection and terminal-link
 * policy. This is a checked deletion plan, not a held directory handle or an
 * atomic filesystem snapshot; callers must not reinterpret or retarget its
 * path.
 *
 * @evidence contracts/common.md#principled-implementation Requested spelling, pinned deletion path and observed presence express distinct cleanup facts; the producer validates every candidate before returning a plan, while this passive type cannot itself prevent subsequent filesystem races.
 * @evidence contracts/common.md#clear-and-simple-design Three fields separate reporting, deletion and missing-cache reporting without embedding filesystem operations or policy flags in each planned target.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Terminal links retain their own deletion spelling rather than pretending removal follows their target; absence remains an observed boolean and does not bypass the resolver's project/root protection.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the producing validation, plan-versus-snapshot limitation and each field's use, with documented-member and tag spacing following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The representation carries physically pinned native paths and distinguishes terminal symlink/junction deletion from requested lexical reporting; the shared resolver, not platform-name string rules in this DTO, owns alias and case interpretation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface SafeCacheCleanupTarget {
  /**
   * The terminal entry existed when the transaction inspected it. A target that
   * did not exist is still returned, so the caller can report it without
   * treating a missing cache as an error.
   */
  exists: boolean;

  /**
   * The path to delete: the physical spelling of the cache directory, or, when
   * the terminal entry is itself a symlink or junction, that link under its
   * pinned physical parent, so recursive removal deletes the link rather than
   * following it into its target.
   */
  path: string;

  /**
   * The directory as the caller requested it, lexically normalized. This is the
   * spelling to report back to the user.
   */
  requestedPath: string;
}
