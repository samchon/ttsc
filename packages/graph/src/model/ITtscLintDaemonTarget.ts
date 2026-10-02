/**
 * One plugin sidecar this daemon can be opened against.
 *
 * @evidence contracts/common.md#principled-implementation Binary, plugin manifest and optional project context identify the sidecar executable and configuration inputs for its verbs.
 * @evidence contracts/common.md#clear-and-simple-design The target groups only launch identity while cwd and tsconfig remain session-owned coordinates.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Plugin configuration is passed through its supported manifest/context flags rather than patched into a running foreign process.
 * @evidence contracts/common.md#meaningful-documentation Native member comments explain binary identity and the two configuration channels.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
export interface ITtscLintDaemonTarget {
  /** Native plugin sidecar executable path. */
  binary: string;

  /** Serialized plugin manifest consumed by the sidecar. */
  manifest: string;

  /** Optional serialized project identity passed to context-aware rules. */
  projectContext?: string;
}
