/**
 * How a resident check sidecar served one cycle.
 *
 * Ordinary diagnostics can report the producer's process identity and Program
 * activity without enabling a separate measurement mode.
 *
 * @evidence contracts/common.md#principled-implementation Process identity, cumulative full loads and incremental updates distinguish producer lifetime from the current cycle's reuse flag.
 * @evidence contracts/common.md#clear-and-simple-design Four scalar observations report residency without exposing the sidecar's mutable Program or adding lifecycle controls to a result record.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Observations are supplied by the real resident producer rather than inferred from plugin names, timing or a benchmark-specific execution path.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies ordinary diagnostic use, and separated member comments explain lifetime and count meanings following the documentation skill.
 */
export interface ResidentCheckTelemetry {
  /** Process id of the sidecar; stable across cycles while it stays resident. */
  pid: number;

  /** Full Program loads since the sidecar started. */
  programLoads: number;

  /** Incremental Program updates since the sidecar started. */
  programUpdates: number;

  /** This cycle reused the warm Program instead of loading a new one. */
  reused: boolean;
}
