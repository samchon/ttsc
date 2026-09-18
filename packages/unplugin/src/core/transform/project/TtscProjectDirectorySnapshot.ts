/** One directory's project-membership identity at generation time. */
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
