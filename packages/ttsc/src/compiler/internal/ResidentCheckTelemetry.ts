/**
 * How a resident check sidecar served one cycle.
 *
 * Ordinary diagnostics can report the producer's process identity and Program
 * activity without enabling a separate measurement mode.
 *
 * Load and update counts classify the producer's accepted state transitions,
 * rather than counting every compiler Program object. An incremental update
 * can create a new generation object while reusing the prior Program's data.
 * Failed load attempts are not counted as successful loads.
 *
 * @evidence contracts/common.md#principled-implementation Process identity, cumulative successful cold loads/full reconstructions and data-reusing updates distinguish producer lifetime from the current cycle's reuse flag; the counters do not assert total compiler object creation.
 * @evidence contracts/common.md#clear-and-simple-design Four scalar observations report residency without exposing the sidecar's mutable Program or adding lifecycle controls to a result record.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Observations are supplied by the real resident producer rather than inferred from plugin names, timing or a benchmark-specific execution path.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies ordinary diagnostic use, and separated member comments explain lifetime and count meanings following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export interface ResidentCheckTelemetry {
  /** Process id of the sidecar; stable across cycles while it stays resident. */
  pid: number;

  /** Successful cold loads and full update reconstructions since startup. */
  programLoads: number;

  /** Data-reusing source updates since startup, counted per changed source. */
  programUpdates: number;

  /**
   * This cycle retained warm Program data without full reconstruction.
   * It does not certify reuse of the same compiler generation object.
   */
  reused: boolean;
}
