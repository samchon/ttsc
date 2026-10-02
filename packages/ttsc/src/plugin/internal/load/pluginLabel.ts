import type { ITtscPlugin } from "../../../structures/ITtscPlugin";
import type { ITtscProjectPluginConfig } from "../../../structures/ITtscProjectPluginConfig";

/**
 * Choose the descriptor label used by loader diagnostics.
 *
 * @evidence contracts/common.md#principled-implementation Nonempty descriptor name wins, then transform specifier and finally the indexed fallback; this identity labels diagnostics without selecting native ownership.
 * @evidence contracts/common.md#clear-and-simple-design One value selector is shared by native admission and downstream loader records.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Plugin names remain diagnostic labels and never confer built-in compiler behavior.
 * @evidence contracts/common.md#meaningful-documentation The headline states the stable fallback identity used by callers.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The selected string or formatted fallback transfers immediately to the caller; no label history, handle or retained population is owned here.
 * @evidence contracts/performance.md#efficient-algorithms Name and specifier type/length checks avoid scanning their contents; an absent selection formats the scalar index. Property reads follow ordinary descriptor semantics and do not bound user-defined accessor work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Label selection defines no shared producer or cross-request descriptor-answer identity; callers own their mutable descriptor and config.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Name/specifier/index values are diagnostic data; this selector does not interpret native paths or acquire filesystem/process capabilities.
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
