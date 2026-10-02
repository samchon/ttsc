/**
 * Construction options for a resident native graph session.
 *
 * @evidence contracts/common.md#principled-implementation Project coordinates and optional binary determine the native producer for one resident session.
 * @evidence contracts/common.md#clear-and-simple-design Construction identity is separate from per-call cancellation controls.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An explicit binary remains supported rather than injecting a fixture-dependent resolver.
 * @evidence contracts/common.md#meaningful-documentation Member comments document producer project coordinates, binary absoluteness and project-relative resolution.
 */
export interface TtscGraphSessionOptions {
  /** Project root passed to `ttscgraph serve`. */
  cwd: string;

  /** Project tsconfig passed to `ttscgraph serve`. */
  tsconfig: string;

  /** Absolute native binary path, resolved from `cwd` when omitted. */
  binary?: string;
}
