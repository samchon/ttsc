import type { FilesystemPathIdentity } from "./FilesystemPathIdentity";

/**
 * A memoizing filesystem-identity resolver for one transaction.
 *
 * Create one with {@link createFilesystemPathIdentityContext} per unit of work
 * (one build, one watch refresh, one runtime question) and ask it every
 * question whose answers should reuse the same observations. Each queried key's
 * realpath and case result is memoized, including missing-entry results.
 *
 * This is not an atomic filesystem snapshot: previously unseen keys can be
 * observed later, after the disk has changed. Begin a new context when the
 * operation needs fresh observations rather than reusing earlier answers.
 *
 * Directory ASCII case capability is explicit: true means observed sensitivity,
 * false means observed insensitivity and undefined means unknown. Missing
 * suffixes fold ASCII letters only for false; an unknown policy preserves exact
 * spelling without establishing that differently cased spellings denote
 * different entries. Non-ASCII letters retain their spelling even under
 * observed insensitivity, because an ASCII case probe does not establish native
 * Unicode name equivalence.
 *
 * Physical resolve/isWithin operations and lexical routing operations answer
 * different questions. Lexical keys preserve link and short-name components;
 * lexical matching admits ASCII case candidates under insensitive or unknown
 * policy and retains non-ASCII component pairs as candidates without asserting
 * physical identity or cache freshness.
 *
 * @evidence contracts/common.md#principled-implementation Resolution, tri-state case capability and containment share keyed observations; unknown policy preserves missing spelling instead of authorizing a merge, and the context makes no atomic guarantee across keys first observed at different times.
 * @evidence contracts/common.md#clear-and-simple-design Six methods distinguish physical resolution/containment, native case capability and lexical key/candidate routing while sharing one probe context; callers need no parallel path-policy implementation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing-entry observations remain memoized outcomes rather than guessed future existence; refreshed work needs a new context instead of layering retries over stale identity premises.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain generation-local observations, tri-state case policy, ASCII identity limits and physical versus lexical use; documented methods and acknowledgments follow the documentation skill's spacing guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath and observed directory capability govern physical identity; unavailable probes remain unknown and only observed insensitivity permits ASCII missing-suffix folding. Lexical routing retains non-ASCII candidate pairs instead of inventing a native Unicode equivalence table.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export type FilesystemPathIdentityContext = {
  /**
   * Whether ASCII names directly inside `directory` are compared
   * case-sensitively, judged at its resolved ancestor where one is available.
   *
   * Returns true for observed sensitivity, false for observed insensitivity, or
   * undefined when the native probes cannot establish the policy. Unknown does
   * not authorize case-folded identity or a claim that a cache input is
   * stable.
   *
   * @evidence contracts/common.md#principled-implementation True and false express observed native case policy at the resolved ancestor; undefined preserves insufficient evidence, so callers cannot treat a failed probe as either equivalence or proven distinction.
   * @evidence contracts/common.md#clear-and-simple-design One tri-state query exposes both case judgment and inability to establish it without requiring a parallel provenance API or duplicated probing logic.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unavailable measurement stays unknown rather than receiving an operating-system default or a preferred answer that makes a desired identity comparison succeed.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain ancestor selection, true/false/undefined and why unknown cannot certify case-folded identity or cache stability, with separated tags under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Directory-specific probes represent Windows per-directory and POSIX volume case behavior; undefined acknowledges unavailable capability instead of inferring it from an OS name.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources caseSensitive declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms caseSensitive declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work caseSensitive declares a signature only; the implementation owns any shared work.
   */
  caseSensitive(directory: string): boolean | undefined;

  /**
   * Whether `candidate` is `root` itself or lies beneath it, compared by
   * identity key so aliases (8.3 names, symlinked or junctioned directories,
   * case variants on a case-insensitive volume) agree.
   *
   * Containment inherits the context's cached observations and case-policy
   * limitations; it does not hold either directory open or refresh its
   * identity.
   *
   * With unknown policy, preserved missing-suffix spelling can leave real
   * case-insensitive aliases separate; this result alone cannot prove complete
   * watcher coverage or authorize cache reuse.
   *
   * @evidence contracts/common.md#principled-implementation Shared resolution and component-delimited keys define root-inclusive identity containment without lexical-prefix overmatch; unknown missing-suffix case policy can conservatively leave aliases separate, so this boolean is not a complete uncertainty proof.
   * @evidence contracts/common.md#clear-and-simple-design The method combines the existing resolve and identity containment operations, keeping callers independent of key encoding details.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Aliases are handled by the shared resolver, not hardcoded directory names or string-prefix exceptions; stale observations are not secretly refreshed inside containment.
   * @evidence contracts/common.md#meaningful-documentation Native prose documents root inclusion, alias equivalence and inherited cache/case limits rather than claiming a held-directory guarantee; tags follow the documentation skill's separation rule.
   * @evidence contracts/portability.md#os-neutral-implementation Native aliases and volume roots are resolved before containment; unknown directory policy preserves exact missing spelling, requiring coverage and reuse owners to handle that uncertainty rather than assuming OS-default folding.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources isWithin declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms isWithin declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work isWithin declares a signature only; the implementation owns any shared work.
   */
  isWithin(root: string, candidate: string): boolean;

  /**
   * Whether a lexical path is a root-inclusive descendant candidate for
   * routing.
   *
   * Native volume roots must agree and root components are compared against
   * corresponding candidate components. For all-ASCII component pairs,
   * sensitive parents require exact names and insensitive or unknown parents
   * admit ASCII case matches. Pairs containing non-ASCII names remain
   * candidates regardless of case capability, because native Unicode
   * equivalence was not established. Link and short-name components are
   * retained rather than physically merged.
   *
   * This is an observation-routing candidate relation, not physical containment
   * proof. Non-ASCII admission deliberately overroutes observations rather than
   * asserting a filesystem's Unicode equivalence or authorizing cache reuse.
   *
   * @evidence contracts/common.md#principled-implementation Native roots and component counts bound root-inclusive lexical descendants; ASCII pairs use exact or case-folded candidates by parent capability, while pairs containing non-ASCII remain possible matches because their native equivalence was not proved.
   * @evidence contracts/common.md#clear-and-simple-design The lexical descendant operation shares component comparison with lexicalMatches and keeps physical containment in isWithin, preventing routing uncertainty from redefining identity keys.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown case evidence expands routing candidates rather than fabricating equality; link spellings remain intact and the relation cannot substitute for physical or generation proof.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain root inclusion, component/case rules, retained aliases, routing purpose and the Unicode/proof limit with separated method tags under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native grammar separates volumes and components, actual parent probes govern ASCII case routing, and non-ASCII admission preserves possible native Unicode aliases without applying an invented OS-independent Unicode table.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources lexicalIsWithin declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms lexicalIsWithin declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work lexicalIsWithin declares a signature only; the implementation owns any shared work.
   */
  lexicalIsWithin(root: string, candidate: string): boolean;

  /**
   * Build a lexical key without replacing link or short-name components.
   *
   * Normalization uses native path grammar. Each component folds ASCII letters
   * only when its parent is observed insensitive; sensitive or unknown parents
   * preserve exact spelling. Non-ASCII letters are not folded by this lexical
   * key, and different keys do not prove distinct physical targets.
   *
   * @evidence contracts/common.md#principled-implementation Component-wise ASCII folding requires observed parent insensitivity, so the key retains uncertain names and lexical alias boundaries rather than merging them through unproved physical equivalence.
   * @evidence contracts/common.md#clear-and-simple-design A named lexical key operation separates spelling-based indexing from resolve's physical identity while reusing the context's native parent-case observations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown capability preserves the name rather than inventing a default-insensitive answer; the key does not resolve away a symlink spelling merely to force it into an existing physical entry.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain component preservation, ASCII-only folding, parent policy and why key inequality is not physical distinction, with separate method tags under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native roots and component separators come from the selected path grammar; directory probes authorize only the supported ASCII case canonicalization instead of universal lowercasing across host filesystems.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources lexicalKey declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms lexicalKey declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work lexicalKey declares a signature only; the implementation owns any shared work.
   */
  lexicalKey(location: string): string;

  /**
   * Whether two lexical spellings are matching observation-routing candidates.
   *
   * Native roots and component counts must agree. Comparison walks the left
   * spelling's parents: all-ASCII pairs require exact names under sensitive
   * policy or admit ASCII case matches under insensitive or unknown policy. If
   * either name contains non-ASCII characters, the pair remains a candidate
   * without assuming a native Unicode equivalence table. Physical alias
   * expansion is deliberately not applied to the compared components.
   *
   * A match is not file equality or a cache proof. Non-ASCII pairs deliberately
   * overroute observations rather than treating uncertain Unicode names as
   * equal.
   *
   * @evidence contracts/common.md#principled-implementation Equal native roots and component counts bound same-location lexical candidates; parent capability controls ASCII comparison, while non-ASCII pairs remain candidates without asserting physical equality or treating unknown as observed insensitivity.
   * @evidence contracts/common.md#clear-and-simple-design The same component relation serves equality-shaped and descendant-shaped routing, while lexicalKey and physical resolve retain their separate indexing and identity responsibilities.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown policy admits an extra candidate comparison rather than certifying equality; no caller may use a true result as replacement evidence for unchanged files or generation validity.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain root/count requirements, left-parent capability, preserved aliases and the routing-versus-proof Unicode limit with separated method tags under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native roots and directory probes control ASCII lexical routing across Windows and POSIX syntax; uncertain Unicode pairs remain candidates so JavaScript casing cannot suppress a possible native alias event.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources lexicalMatches declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms lexicalMatches declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work lexicalMatches declares a signature only; the implementation owns any shared work.
   */
  lexicalMatches(left: string, right: string): boolean;

  /**
   * Resolve `location`, existing or not, to its physical path and comparison
   * key.
   *
   * Existing ancestors are resolved natively. Missing suffix ASCII letters fold
   * only for observed insensitivity, retaining exact case for sensitivity or
   * unknown policy. Repeated normalized keys reuse the context's earlier
   * observation; realpath error handling follows the creator's configured
   * policy.
   *
   * Non-ASCII letters in missing names preserve spelling because native Unicode
   * case equivalence was not established by the ASCII capability probe.
   *
   * @evidence contracts/common.md#principled-implementation Physical ancestor resolution and ASCII-only folding under observed insensitivity avoid merging unknown or unproved Unicode suffixes; normalized queries reuse captured premises, while preserved spellings do not prove distinct physical entries.
   * @evidence contracts/common.md#clear-and-simple-design One identity result groups path spelling and comparison key while native probing and memoization stay private to the creator.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Resolution uses actual native observations and an explicit error policy; missing suffixes are represented without fabricating an existing entry or patching filesystem methods.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain physical/key results, missing suffixes, memo reuse and error-policy ownership with separated method tags under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native alias expansion and directory capability govern identity using selected path grammar; unknown policy preserves missing names and non-ASCII letters are never folded by the suffix canonicalizer, avoiding universal lowercasing or an OS default.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources resolve declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms resolve declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work resolve declares a signature only; the implementation owns any shared work.
   */
  resolve(location: string): FilesystemPathIdentity;
};
