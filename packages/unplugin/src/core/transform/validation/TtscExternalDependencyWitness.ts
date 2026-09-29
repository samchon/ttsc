/**
 * The state of one plugin-reported dependency path, read before a compile so
 * the state read after it can be proven to be the one the compile saw.
 *
 * A dependency-only path carries no compiler-time proof: the plugin names it,
 * and nothing records what it read. A reading taken after the compile certifies
 * only that the compile saw it when this reading still holds then, the same
 * bytes, physical target, and metadata, the way the project walks before and
 * after a compile prove the project held still (samchon/ttsc#1541).
 *
 * @evidence contracts/common.md#principled-implementation Content/kind, physical target, metadata and read stability retain distinct facts needed for a plugin-only precompile witness.
 * @evidence contracts/common.md#clear-and-simple-design One record groups one dependency spelling observation without embedding its generation or validator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Metadata stability alone cannot substitute for an unobserved plugin read or a changed physical target.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain compiler-proof absence and precompile witnessing; member comments distinguish null state, unavailable metadata and raced reads.
 * @evidence contracts/portability.md#os-neutral-implementation Physical targets, native metadata and content remain distinct representations of alias and clock behavior without OS-name assumptions.
 */
export interface TtscExternalDependencyWitness {
  /** Content or kind fingerprint, null when absent or unreadable. */
  hash: string | null;

  /** Physical target, null when native resolution could not select one. */
  realpath: string | null;

  /** Metadata signature, `undefined` when the path could not be stat'ed. */
  signature: string | undefined;

  /**
   * Whether the metadata held across the reading itself. A reading a write
   * raced describes no single state, so it witnesses nothing.
   */
  stable: boolean;
}
