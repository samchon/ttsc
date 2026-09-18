/**
 * One path answered by the filesystem, in two forms that answer different
 * questions.
 *
 * `path` is the spelling to hand back to the filesystem or to a user: the
 * physical spelling of every existing segment (reparse points and Windows 8.3
 * names expanded) followed by the missing suffix as the caller wrote it. `key`
 * is the spelling to compare: equal keys mean one file or directory, whichever
 * alias reached it. Two paths are never compared by `path`, because a drive
 * letter's case and a case-insensitive suffix both vary between spellings of
 * one location.
 *
 * Produced by {@link FilesystemPathIdentityContext.resolve}.
 */
export type FilesystemPathIdentity = {
  /**
   * Comparison key. Equal keys denote the same filesystem entry. On Windows the
   * volume root is lower-cased, and a missing suffix under a case-insensitive
   * directory is folded to lower case so it matches every future spelling.
   */
  key: string;

  /**
   * Physical spelling: existing segments as the filesystem reports them, then
   * the missing suffix. Use it to open, watch, or print the location.
   */
  path: string;
};
