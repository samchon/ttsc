/**
 * One plugin as the capability-resolution cache records it.
 *
 * The cache answers "which plugins declare capability X" without evaluating
 * every descriptor again; each recorded plugin keeps what that answer needs.
 *
 * @evidence contracts/common.md#principled-implementation Executable path plus named boolean opt-ins preserves the capability-selection answer without retaining a live factory or descriptor graph.
 * @evidence contracts/common.md#clear-and-simple-design Two fields expose only dispatch identity and supported behavior, with build/input validity owned by the enclosing cache entry.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Capabilities come from the descriptor's declaration rather than inference from a plugin name or binary basename.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc describes the narrower cache purpose and absolute executable identity; member spacing and separate acknowledgment prose follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export interface ITtscCapabilityResolutionPlugin {
  /** Absolute path of the plugin's native sidecar executable. */
  binary: string;

  /** The capabilities the plugin's descriptor declared, by name. */
  capabilities: Record<string, boolean>;
}
