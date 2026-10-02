import type { ITtscPlugin } from "../../../structures/ITtscPlugin";

/**
 * Require a nonempty string source on a plugin descriptor.
 *
 * @evidence contracts/common.md#principled-implementation The actual loader accepts only nonempty string source identity; absent, empty and nonstring values retain the same authored diagnostic.
 * @evidence contracts/common.md#clear-and-simple-design One predicate distinguishes source presence before path resolution and native admission.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The production loader calls this source-field guard before native path admission; no expected descriptor value or test-side implementation replaces that operation.
 * @evidence contracts/common.md#meaningful-documentation The headline identifies the accepted descriptor field and the rejected boundary.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources validatePluginSource acquires no handle, buffer or cache and retains nothing after it returns.
 * @evidence contracts/performance.md#efficient-algorithms Source admission checks property type and string length without scanning source contents or resolving paths. Property reads retain ordinary descriptor object semantics; this guard does not bound user-defined accessor work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work No expensive shared producer, reusable-answer identity or cross-request state is coordinated by this source-field guard.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation validatePluginSource computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
 */
export function validatePluginSource(plugin: ITtscPlugin): void {
  if (typeof plugin.source !== "string" || plugin.source.length === 0) {
    throw new Error(`ttsc: plugin must declare source`);
  }
}
