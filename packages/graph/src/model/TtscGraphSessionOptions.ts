/**
 * Construction options for a resident native graph session.
 *
 * @evidence contracts/common.md#principled-implementation Project coordinates and optional binary determine the native producer for one resident session.
 * @evidence contracts/common.md#clear-and-simple-design Construction identity is separate from per-call cancellation controls.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An explicit binary remains supported rather than injecting a fixture-dependent resolver.
 * @evidence contracts/common.md#meaningful-documentation Member comments document producer project coordinates, binary absoluteness and project-relative resolution.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscGraphSessionOptions declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscGraphSessionOptions declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscGraphSessionOptions declares a data shape or groups members and coordinates no computation across requests.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation TtscGraphSessionOptions declares a data shape or groups members and performs no filesystem, path or process operation.
 */
export interface TtscGraphSessionOptions {
  /** Project root passed to `ttscgraph serve`. */
  cwd: string;

  /** Project tsconfig passed to `ttscgraph serve`. */
  tsconfig: string;

  /** Absolute native binary path, resolved from `cwd` when omitted. */
  binary?: string;
}
