/**
 * What the resolved configuration says can and cannot enter the program.
 *
 * The project walk exists to notice files entering and leaving the _program_,
 * so both halves of that question belong to configuration rather than to a
 * guess. Before this the walk answered both from one hardcoded list of
 * directory names, which was wrong in both directions at once: a bundler
 * writing to any directory the list did not name changed project membership
 * with its own output, and a source directory whose name the list did name was
 * dropped from the walk entirely (samchon/ttsc#1307).
 */
export interface ITtscProjectMembershipPolicy {
  /**
   * Absolute root-file specifications, with TypeScript-Go's default include,
   * every file below the config directory, materialized when neither list is
   * declared.
   *
   * Absent only when the configuration could not be read, in which case every
   * path is a possible root and only the walk's ignored names bound it.
   */
  rootFileSpecs?: Readonly<{
    files: readonly string[];
    include: readonly string[];
    /**
     * The requested root and its regular/native realpath spellings, without
     * following child links. Native realpath expands Windows short names.
     */
    root?: Readonly<{ path: string; realpath: string; nativepath?: string }>;
  }>;
  /**
   * Absolute directory exclusions separated by the configuration entry that
   * contributed them.
   *
   * Optional for compatibility with hosts that constructed this public policy
   * before exclusion provenance was exposed. Without it, an overlay preserves
   * every entry in `excludedDirectories` as an explicit exclusion because
   * silently admitting a directory is the unsafe fallback.
   */
  directoryExclusionOrigins?: Readonly<{
    declarationDir?: string;
    exclude: readonly string[];
    outDir?: string;
    /** Whether output options supply TypeScript's implicit default exclude. */
    useImplicitOutputExclusions?: boolean;
  }>;
  /** Absolute directories the resolved configuration keeps out of the program. */
  excludedDirectories: readonly string[];
  /** Lowercased extensions a file needs to be a possible program input. */
  inputExtensions: readonly string[];
  /**
   * Every config file consulted to produce this policy, the leaf and its whole
   * `extends` ancestry.
   *
   * A caller that memoizes a policy has to know when to stop trusting it, and
   * the leaf alone cannot tell it: adding `exclude` to a shared
   * `tsconfig.base.json` leaves the leaf untouched while changing every answer
   * this policy gives.
   */
  sources: readonly string[];
}
