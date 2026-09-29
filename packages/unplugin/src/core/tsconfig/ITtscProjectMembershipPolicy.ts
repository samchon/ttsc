/**
 * An immutable description of what can and cannot enter the program.
 *
 * The project walk exists to notice files entering and leaving the _program_,
 * so both halves of that question belong to configuration rather than to a
 * guess. Before this the walk answered both from one hardcoded list of
 * directory names, which was wrong in both directions at once: a bundler
 * writing to any directory the list did not name changed project membership
 * with its own output, and a source directory whose name the list did name was
 * dropped from the walk entirely (samchon/ttsc#1307).
 *
 * @evidence contracts/common.md#principled-implementation
 *   Root specs, extension admission, exclusion provenance and config sources
 *   represent the resolved program-selection policy, with an explicit unknown
 *   root state and an optional compiler-reported name-comparison rule.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One policy couples selection with the provenance needed to overlay output
 *   options and invalidate a memo. Consumers implement matching and lifecycle.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Requested, regular-realpath and native-realpath roots carry observed native
 *   representations separately. The optional compiler-reported case flag governs
 *   pattern matching rather than imposing a universal source-filesystem OS rule.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Selection comes from config meaning and the compiler's reported case rule;
 *   the type does not encode a list of known consumers' directory names.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member paragraphs explain permissive unreadable configs, compatibility
 *   provenance, inherited inputs and compiler case policy with their reasons.
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
  readonly rootFileSpecs?: Readonly<{
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
  readonly directoryExclusionOrigins?: Readonly<{
    declarationDir?: string;
    exclude: readonly string[];
    outDir?: string;

    /** Whether output options supply TypeScript's implicit default exclude. */
    useImplicitOutputExclusions?: boolean;
  }>;

  /** Absolute directories the resolved configuration keeps out of the program. */
  readonly excludedDirectories: readonly string[];

  /** Lowercased extensions a file needs to be a possible program input. */
  readonly inputExtensions: readonly string[];

  /**
   * Every config file consulted to produce this policy, including inherited
   * declarations and unresolved file candidates. A query can stop at its own
   * declaration, so this is not necessarily the complete `extends` graph.
   *
   * A caller that memoizes a policy has to know when to stop trusting it, and
   * the leaf alone cannot tell it: adding `exclude` to a shared
   * `tsconfig.base.json` leaves the leaf untouched while changing every answer
   * this policy gives.
   */
  readonly sources: readonly string[];

  /**
   * Whether the compiler compares file names case-sensitively, as the envelope
   * reported it (`IReferenceGraph.useCaseSensitiveFileNames`,
   * samchon/ttsc#1545). TypeScript-Go decides it from the filesystem its
   * executable lives on, not from the platform, so root specs match the way the
   * compiler matches them only under its own answer. Absent until a compile
   * reported it; `policyUsesCaseSensitiveFileNames` then supplies the answer
   * that compiler gives by TypeScript-Go's own rule (samchon/ttsc#1563).
   */
  readonly useCaseSensitiveFileNames?: boolean;
}
