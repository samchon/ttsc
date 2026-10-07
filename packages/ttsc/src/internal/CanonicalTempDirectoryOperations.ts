/**
 * The filesystem primitives {@link createCanonicalTempDirectory} uses.
 *
 * The creator uses these synchronous observations to pin a physical parent,
 * allocate a child and check its resulting path. Injected implementations must
 * describe the same native filesystem and propagate operation errors; this
 * interface does not provide an atomic snapshot or held-directory guarantee.
 *
 * @evidence contracts/common.md#principled-implementation Link-preserving stat, unique allocation and physical resolution expose the distinct facts needed to validate one temporary directory; their signatures describe synchronous operations and do not claim atomicity between observations.
 * @evidence contracts/common.md#clear-and-simple-design Three required primitives form the creator's filesystem boundary without embedding cleanup policy, a retry mechanism or unrelated directory traversal in the interface.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit primitive injection is the supported boundary; implementations must report actual native results instead of replacing foreign globals or fabricating a child that matches the postflight.
 * @evidence contracts/common.md#meaningful-documentation Native prose states caller semantics, consistent-filesystem and error premises and the atomicity limit; documented method blocks and type acknowledgments remain separated under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Physical resolution must expand native aliases including symlinks, junctions and Windows short names, while link-preserving stat distinguishes the actual entry instead of relying on path spelling or OS-name guesses.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface CanonicalTempDirectoryOperations {
  /**
   * Link-preserving stat. Used twice: to prove the physical parent is a real
   * directory before creation, and to prove the created child is one too.
   *
   * Errors propagate to the creator; an unresolved entry must not be reported
   * as a valid directory.
   *
   * @evidence contracts/common.md#principled-implementation A link-preserving observation exposes the entry's directory kind, so the creator can reject a terminal link rather than accepting the kind of its target.
   * @evidence contracts/common.md#clear-and-simple-design The returned isDirectory predicate supplies exactly the kind check the preflight and postflight need; path resolution remains the separate realpath operation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Injected stat must describe the actual entry and propagate failure rather than supplying a synthetic positive directory result to satisfy validation.
   * @evidence contracts/common.md#meaningful-documentation Native prose names both checks, link preservation and error effects, with a blank line before method acknowledgments under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Implementations use native link-preserving stat semantics, including junction/reparse entries, rather than inferring directory kind from separators or filename suffixes.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources lstat declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms lstat declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work lstat declares a signature only; the implementation owns any shared work.
   */
  lstat(location: string): { isDirectory(): boolean };

  /**
   * Create a unique directory whose native path starts with `prefix`.
   *
   * The prefix already includes the pinned physical parent. Return the created
   * path and propagate allocation failure; the creator checks containment and
   * directory kind before authorizing its use.
   *
   * @evidence contracts/common.md#principled-implementation Unique-directory allocation appends a distinguishing suffix to the supplied native prefix; returning the created path gives postflight validation its actual subject.
   * @evidence contracts/common.md#clear-and-simple-design This primitive owns allocation only; parent identity, allowed prefix shape and postflight checks remain with the creator.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A successful call must allocate an actual unique directory rather than return a fixed known path or fabricate success after an allocation error.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the parent-bearing prefix, returned path, failure propagation and postflight ownership, with separate method tags under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation The prefix is a native path assembled by the creator and consumed by a filesystem allocation API; no shell syntax, fixed temporary root or OS-specific suffix is required by the signature.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources mkdtemp declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms mkdtemp declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work mkdtemp declares a signature only; the implementation owns any shared work.
   */
  mkdtemp(prefix: string): string;

  /**
   * Physical path of an existing entry. Must expand every alias (symlinks,
   * junctions, Windows 8.3 names), because the returned spelling is what later
   * writes and recursive cleanup are anchored to.
   *
   * Missing or inaccessible paths must fail instead of returning a guessed
   * physical spelling.
   *
   * @evidence contracts/common.md#principled-implementation Resolving an existing entry to its physical path removes mutable lexical aliases before the creator compares parent and child locations; the returned spelling must correspond to the observed filesystem entry.
   * @evidence contracts/common.md#clear-and-simple-design Physical spelling is one primitive result; the creator owns when to resolve and how to compare containment instead of asking this operation to enforce temporary-directory policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts All aliases must be resolved through supported native semantics, not replaced with an assumed parent or fixture-specific canonical name when resolution fails.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains alias expansion, later write/cleanup anchoring and failure meaning, with separated method acknowledgments under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native physical resolution includes Windows short-name and junction aliases as well as symlinks; manual separator normalization or lowercase conversion cannot substitute for this boundary.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources realpath declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms realpath declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work realpath declares a signature only; the implementation owns any shared work.
   */
  realpath(location: string): string;
}
