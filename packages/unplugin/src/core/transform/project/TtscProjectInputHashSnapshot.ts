/**
 * One project-walk hash set together with its completeness proof.
 *
 * @evidence contracts/common.md#principled-implementation The completeness flag prevents a partial hash dictionary from representing a coherent project snapshot; slash-relative keys define its comparison namespace.
 * @evidence contracts/common.md#clear-and-simple-design The container separates observation completeness from collected hashes without introducing another snapshot owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An unreadable input cannot disappear into an apparently complete successful snapshot merely because other file hashes were available.
 * @evidence contracts/common.md#meaningful-documentation The native field comments identify the rejection requirement and hash-key encoding rather than restating their TypeScript types.
 */
export interface TtscProjectInputHashSnapshot {
  /**
   * Whether every attempted directory and file was observed coherently;
   * cache-key hosts must reject an incomplete set.
   */
  complete: boolean;

  /** SHA-256 of every walked input, keyed by project-relative slash path. */
  hashes: Record<string, string>;
}
