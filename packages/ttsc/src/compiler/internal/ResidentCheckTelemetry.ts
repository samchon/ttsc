/**
 * How a resident check sidecar served one cycle.
 *
 * It makes residency observable without benchmark-only hooks: the launcher
 * surfaces it only under the ordinary diagnostics flag, and the watch tests use
 * it to prove a cycle was served incrementally rather than by a fresh process.
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
