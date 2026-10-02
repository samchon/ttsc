/**
 * One plugin sidecar this daemon can be opened against.
 *
 * @evidence contracts/common.md#principled-implementation Binary, plugin manifest and optional project context identify the sidecar executable and configuration inputs for its verbs.
 * @evidence contracts/common.md#clear-and-simple-design The target groups only launch identity while cwd and tsconfig remain session-owned coordinates.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Plugin configuration is passed through its supported manifest/context flags rather than patched into a running foreign process.
 * @evidence contracts/common.md#meaningful-documentation Native member comments explain binary identity and the two configuration channels.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintDaemonTarget declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintDaemonTarget declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintDaemonTarget declares a data shape or groups members and coordinates no computation across requests.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintDaemonTarget declares a data shape or groups members and performs no filesystem, path or process operation.
 */
export interface ITtscLintDaemonTarget {
  /** Native plugin sidecar executable path. */
  binary: string;

  /** Serialized plugin manifest consumed by the sidecar. */
  manifest: string;

  /** Optional serialized project identity passed to context-aware rules. */
  projectContext?: string;
}
