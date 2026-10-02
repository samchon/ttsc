/**
 * Immutable configuration premises for conservative project-root discovery.
 *
 * Root specifications, admitted extensions and represented directory
 * exclusions drive the project walk. Imported dependencies outside this
 * selection remain compiler inputs and receive separate external proof.
 * Readers keep unsupported exclusion globs conservative rather than claiming
 * that this representation is the compiler's complete membership verdict.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Root specs, extension admission, exclusion provenance and config sources
 *   represent root-discovery premises, with an explicit unknown root state and
 *   an optional compiler comparison answer whose source the producer owns.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One policy couples selection with the provenance needed to overlay output
 *   options and invalidate a memo. Consumers implement matching and lifecycle.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Selection comes from config meaning and explicit comparison policy;
 *   the type does not encode a list of known consumers' directory names.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member paragraphs explain permissive unreadable configs, compatibility
 *   provenance, inherited inputs and compiler case policy with their reasons.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Requested, regular-realpath and native-realpath roots carry observed native
 *   representations separately. The optional compiler comparison flag governs
 *   pattern matching rather than imposing a universal source-filesystem OS rule.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   ITtscProjectMembershipPolicy only declares a shape; it has no computation
 *   at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   ITtscProjectMembershipPolicy only declares a shape; it has no work to
 *   reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   ITtscProjectMembershipPolicy only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface ITtscProjectMembershipPolicy {
  /**
   * Absolute root-file specifications. The reader materializes the default
   * recursive include when neither list is declared; matching still applies its
   * extension, hidden/package and JSON admission rules.
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

  /** Absolute directory exclusions represented for project-root discovery. */
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
   * Compiler name-comparison answer used by this policy. Capture prefers the
   * envelope's IReferenceGraph.useCaseSensitiveFileNames report but may prime
   * an attempt with a provisional answer. This rule is independent of the
   * source filesystem's native case capability. When this field is absent,
   * policyUsesCaseSensitiveFileNames supplies a provisional cache-root proxy;
   * it does not certify the executable's actual answer. Capture replaces that
   * approximation with an available report and refuses a differently primed
   * walk before retrying.
   */
  readonly useCaseSensitiveFileNames?: boolean;
}
