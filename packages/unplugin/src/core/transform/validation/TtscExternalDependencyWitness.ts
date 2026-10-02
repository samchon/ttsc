/**
 * Endpoint observations of one plugin-reported dependency, taken before a
 * compile and compared with postcompile observations during admission.
 *
 * The plugin reports a dependency path without recording its read contents.
 * This witness supplies content/kind, physical target and observed metadata
 * boundaries for the admission policy; it is not a compiler-time read proof or
 * an atomic observation of every state during the interval.
 *
 * @evidence contracts/common.md#principled-implementation Content/kind, physical target, metadata and read stability retain distinct facts needed for a plugin-only precompile witness.
 * @evidence contracts/common.md#clear-and-simple-design One record groups one dependency spelling observation without embedding its generation or validator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Metadata stability alone cannot substitute for an unobserved plugin read or a changed physical target.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain compiler-proof absence and precompile witnessing; member comments distinguish null state, unavailable metadata and raced reads.
 * @evidence contracts/portability.md#os-neutral-implementation Physical targets, native metadata and content remain distinct representations of alias and clock behavior without OS-name assumptions.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   The carrier defines observed fields; witness capture and postcompile
 *   validators own native reads and comparison algorithms.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   The representation defines no sharing coordinator; the compile attempt
 *   and admission owner establish the witness's valid observation window.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Attempt-owned witness maps control lifetime; this record defines no
 *   independent handle/task acquisition or retention policy.
 */
export interface TtscExternalDependencyWitness {
  /** Content or kind fingerprint, null when absent or unreadable. */
  hash: string | null;

  /** Physical target, null when native resolution could not select one. */
  realpath: string | null;

  /** Metadata signature, `undefined` when the path could not be stat'ed. */
  signature: string | undefined;

  /**
   * Equality of the before/after observed signatures, including two undefined
   * results. This flag alone proves neither usable metadata nor atomic content.
   */
  stable: boolean;
}
