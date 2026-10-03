/**
 * One path answered by the filesystem, in two forms that answer different
 * questions.
 *
 * `path` is the spelling to hand back to the filesystem or to a user: the
 * observed physical prefix (reparse points and Windows 8.3 names expanded when
 * resolved) followed by an unresolved suffix canonicalized according to the
 * resolved ancestor's measured ASCII case policy. In strict resolution the
 * suffix represents missing path structure; best-effort resolution can also
 * retain unreadable existing entries. If no prefix resolves, the path remains
 * lexically normalized. `key` is the spelling to compare under those
 * observations; unresolved names are locations, not proof
 * that an entry exists. Unknown case policy and unproved Unicode equivalence
 * retain distinct keys, so key inequality cannot prove physical distinction.
 *
 * Produced by {@link FilesystemPathIdentityContext.resolve}.
 *
 * @evidence contracts/common.md#principled-implementation The pair separates comparison spelling from the path usable by native consumers. Resolved prefixes use native physical observations, and unresolved ASCII suffixes fold only under observed insensitivity; best-effort mode does not certify that every existing entry resolved. Unknown and Unicode variants may retain different keys without proof of distinct physical entries.
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
   * volume roots use native root grammar. Unresolved ASCII letters fold only under
   * measured insensitivity; unknown and non-ASCII variants can retain distinct
   * keys even when a later native observation would establish an alias.
   */
  key: string;

  /**
   * Observed physical prefix followed by the unresolved suffix, or lexical
   * spelling if no prefix resolved. Use it to open, watch, or print the location;
   * best-effort output is not proof that every existing segment was resolved.
   */
  path: string;
};
