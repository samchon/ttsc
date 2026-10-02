import type { ITtscPlugin } from "../../../structures/ITtscPlugin";
import type { ITtscProjectPluginConfig } from "../../../structures/ITtscProjectPluginConfig";

/**
 * Choose the descriptor label used by loader diagnostics.
 *
 * @evidence contracts/common.md#principled-implementation Nonempty descriptor name wins, then transform specifier and finally the indexed fallback; this identity labels diagnostics without selecting native ownership.
 * @evidence contracts/common.md#clear-and-simple-design One value selector is shared by native admission and downstream loader records.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Plugin names remain diagnostic labels and never confer built-in compiler behavior.
 * @evidence contracts/common.md#meaningful-documentation The headline states the stable fallback identity used by callers.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources pluginLabel declares a signature only; the implementation owns acquisition and release of resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms pluginLabel declares a signature only; the implementation owns the processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work pluginLabel declares a signature only; the implementation owns any shared work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation pluginLabel is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
 */
export function pluginLabel(
  plugin: ITtscPlugin,
  config: ITtscProjectPluginConfig,
  index: number,
): string {
  if (typeof plugin.name === "string" && plugin.name.length !== 0) {
    return plugin.name;
  }
  if (typeof config.transform === "string" && config.transform.length !== 0) {
    return config.transform;
  }
  return `#${index}`;
}
