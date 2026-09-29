import type { ResolvedTtscUnpluginOptions } from "../../options/ResolvedTtscUnpluginOptions";

/**
 * Returns `true` when the caller has explicitly opted out of all plugins. An
 * empty array is treated as disabled so we don't invoke the compiler for a
 * no-op transform.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Explicit false and the empty override list both select zero plugins;
 *   undefined remains eligible for project-owned discovery.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One predicate centralizes the early exit shared by transform callers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The two cases implement plugin override semantics, not a fixture shortcut.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains the empty-list no-op and explicit opt-out, separated
 *   from acknowledgments according to documentation guidance.
 */
export function pluginsAreDisabled(
  plugins: ResolvedTtscUnpluginOptions["plugins"],
): boolean {
  return plugins === false || (Array.isArray(plugins) && plugins.length === 0);
}
