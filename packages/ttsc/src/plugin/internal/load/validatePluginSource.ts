import type { ITtscPlugin } from "../../../structures/ITtscPlugin";

/**
 * Require a nonempty string source on a plugin descriptor.
 *
 * @evidence contracts/common.md#principled-implementation The actual loader accepts only nonempty string source identity; absent, empty and nonstring values retain the same authored diagnostic.
 * @evidence contracts/common.md#clear-and-simple-design One predicate distinguishes source presence before path resolution and native admission.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The guard is mechanically extracted from the production loader and retains its original value semantics.
 * @evidence contracts/common.md#meaningful-documentation The headline identifies the accepted descriptor field and the rejected boundary.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources validatePluginSource acquires no handle, buffer or cache and retains nothing after it returns.
 * @evidenceExclude contracts/performance.md#efficient-algorithms validatePluginSource performs a fixed number of steps with no loop or recursion over caller data.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work validatePluginSource computes one result per call, so there is no repeated work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation validatePluginSource computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
 */
export function validatePluginSource(plugin: ITtscPlugin): void {
  if (typeof plugin.source !== "string" || plugin.source.length === 0) {
    throw new Error(`ttsc: plugin must declare source`);
  }
}
