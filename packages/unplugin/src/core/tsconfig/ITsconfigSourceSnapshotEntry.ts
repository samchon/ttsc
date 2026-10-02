/**
 * One config-chain input captured for generation-state comparison.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A source path paired with UTF-8 text or null distinguishes observed content
 *   from an unavailable candidate, allowing config-state comparison.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Each entry contains one source observation; graph ordering and comparison
 *   remain snapshot-reader and generation-owner responsibilities.
 *
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Unavailable input has an explicit null state rather than invented bytes
 *   that would claim successful configuration evidence.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The member comments state decoding, unavailable content and path spelling;
 *   native property explanations are retained without property acknowledgments.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The path carries lexical native spelling, not a URL or physical identity;
 *   contents is decoded source observation and null expresses unavailable proof.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   ITsconfigSourceSnapshotEntry only declares a shape; it has no computation
 *   at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   ITsconfigSourceSnapshotEntry only declares a shape; it has no work to
 *   reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   ITsconfigSourceSnapshotEntry only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface ITsconfigSourceSnapshotEntry {
  /** UTF-8 source text, or `null` when a config cannot be read or parsed. */
  contents: string | null;

  /** Absolute lexical spelling used to read the config and anchor its bases. */
  path: string;
}
