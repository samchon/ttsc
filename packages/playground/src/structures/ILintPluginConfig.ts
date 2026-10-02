/**
 * Options for the `@ttsc/lint` integration of {@link createWorkerCompiler}.
 *
 * @evidence contracts/common.md#principled-implementation An optional registration name selects the host's lint verb without conflating its identity with enablement.
 * @evidence contracts/common.md#clear-and-simple-design The record contains only the integration-owned name; factory options own disabling the integration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The default id is a registered product integration and remains caller-configurable.
 * @evidence contracts/common.md#meaningful-documentation Native comments identify registration ownership and the default id, with prose separated from tags under the documentation skill.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
 */
export interface ILintPluginConfig {
  /** Plugin id registered with `host.Expose` (default: `"@ttsc/lint"`). */
  name?: string;
}
