/**
 * One cache directory that a clean transaction has proven safe to delete.
 *
 * Produced by {@link resolveSafeCacheCleanupTargets} only after every requested
 * directory has been resolved and checked, so a caller that removes `path` for
 * each target never deletes a filesystem root or anything that contains the
 * project.
 */
export interface SafeCacheCleanupTarget {
  /**
   * The directory existed when the transaction inspected it. A target that did
   * not exist is still returned, so the caller can report it without treating a
   * missing cache as an error.
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
