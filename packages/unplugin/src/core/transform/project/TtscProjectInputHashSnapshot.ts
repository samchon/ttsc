/**
 * One project-walk hash set together with its completeness proof.
 *
 * @evidence contracts/common.md#principled-implementation The completeness flag carries the rejection evidence for partial admitted-file observations; consumers must check it. Slash-encoded identity keys are root-relative when contained and full addresses otherwise, describing the admitted walk rather than all compiler dependencies.
 * @evidence contracts/common.md#clear-and-simple-design The container separates observation completeness from collected hashes without introducing another snapshot owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An unreadable input cannot disappear into an apparently complete successful snapshot merely because other file hashes were available.
 * @evidence contracts/common.md#meaningful-documentation The native field comments identify the rejection requirement and hash-key encoding rather than restating their TypeScript types.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Hash keys carry native file identities encoded in the compiler's slash
 *   protocol, root-relative when contained and full addresses otherwise.
 *   The snapshot producer and supplied identity context own native root, link
 *   and case interpretation; the container preserves their comparison boundary.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscProjectInputHashSnapshot only declares a shape; it has no computation
 *   at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscProjectInputHashSnapshot only declares a shape; it has no work to
 *   reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscProjectInputHashSnapshot only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface TtscProjectInputHashSnapshot {
  /**
   * Whether every attempted directory and file was observed coherently;
   * cache-key hosts must reject an incomplete set.
   */
  complete: boolean;

  /** SHA-256 of admitted regular-file reads, keyed by slash-encoded identity. */
  hashes: Record<string, string>;
}
