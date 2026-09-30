import type { ITtscPlugin } from "../../../structures/ITtscPlugin";

/**
 * Require a nonempty string source on a plugin descriptor.
 *
 * @evidence contracts/common.md#principled-implementation The actual loader accepts only nonempty string source identity; absent, empty and nonstring values retain the same authored diagnostic.
 * @evidence contracts/common.md#clear-and-simple-design One predicate distinguishes source presence before path resolution and native admission.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The guard is mechanically extracted from the production loader and retains its original value semantics.
 * @evidence contracts/common.md#meaningful-documentation The headline identifies the accepted descriptor field and the rejected boundary.
 */
export function validatePluginSource(plugin: ITtscPlugin): void {
  if (typeof plugin.source !== "string" || plugin.source.length === 0) {
    throw new Error(`ttsc: plugin must declare source`);
  }
}
