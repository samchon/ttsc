/**
 * Options for the `@ttsc/lint` integration of {@link createWorkerCompiler}.
 *
 * @evidence contracts/common.md#principled-implementation An optional registration name selects the host's lint verb without conflating its identity with enablement.
 * @evidence contracts/common.md#clear-and-simple-design The record contains only the integration-owned name; factory options own disabling the integration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The default id is a registered product integration and remains caller-configurable.
 * @evidence contracts/common.md#meaningful-documentation Native comments identify registration ownership and the default id, with prose separated from tags under the documentation skill.
 */
export interface ILintPluginConfig {
  /** Plugin id registered with `host.Expose` (default: `"@ttsc/lint"`). */
  name?: string;
}
