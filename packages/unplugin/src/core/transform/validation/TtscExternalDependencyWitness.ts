/**
 * The state of one plugin-reported dependency path, read before a compile so
 * the state read after it can be proven to be the one the compile saw.
 *
 * A dependency-only path carries no compiler-time proof: the plugin names it,
 * and nothing records what it read. A reading taken after the compile certifies
 * only that the compile saw it when this reading still holds then, the same
 * bytes, physical target, and metadata, the way the project walks before and
 * after a compile prove the project held still (samchon/ttsc#1541).
 */
export interface TtscExternalDependencyWitness {
  /** Content or kind fingerprint, `null` when the path is absent. */
  hash: string | null;
  /** Physical target the path selected, `null` when it selected none. */
  realpath: string | null;
  /** Metadata signature, `undefined` when the path could not be stat'ed. */
  signature: string | undefined;
  /**
   * Whether the metadata held across the reading itself. A reading a write
   * raced describes no single state, so it witnesses nothing.
   */
  stable: boolean;
}
