/**
 * One path answered by the filesystem, in two forms that answer different
 * questions.
 *
 * `path` is the spelling to hand back to the filesystem or to a user: the
 * physical spelling of every existing segment (reparse points and Windows 8.3
 * names expanded) followed by a missing suffix canonicalized according to its
 * nearest existing ancestor's measured ASCII case policy. `key` is the spelling
 * to compare under those observations; missing names are locations, not proof
 * that an entry exists. Unknown case policy and unproved Unicode equivalence
 * retain distinct keys, so key inequality cannot prove physical distinction.
 *
 * Produced by {@link FilesystemPathIdentityContext.resolve}.
 *
 * @evidence contracts/common.md#principled-implementation The pair separates comparison spelling from the path usable by native consumers; existing segments are physically resolved and missing ASCII suffixes fold only under observed insensitivity. Unknown and Unicode variants may retain different keys without proof of distinct physical entries.
 * @evidence contracts/common.md#clear-and-simple-design Two named fields expose the distinction without storing a second independently computed identity policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The representation records native resolution outcomes instead of fixture spellings or global case-folding assertions.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain comparison versus returned spelling, missing-suffix canonicalization and member use; documented properties are separated and carry no acknowledgment tags.
 * @evidence contracts/portability.md#os-neutral-implementation Existing native aliases and Windows volume-root spelling are represented separately from missing-suffix case policy; unknown directory policy preserves exact spellings and cannot authorize treating case variants as equivalent.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export type FilesystemPathIdentity = {
  /**
   * Comparison key under this transaction's filesystem observations. Windows
   * volume roots use native root grammar. Missing ASCII letters fold only under
   * measured insensitivity; unknown and non-ASCII variants can retain distinct
   * keys even when a later native observation would establish an alias.
   */
  key: string;

  /**
   * Physical spelling: existing segments as the filesystem reports them, then
   * the missing suffix. Use it to open, watch, or print the location.
   */
  path: string;
};
