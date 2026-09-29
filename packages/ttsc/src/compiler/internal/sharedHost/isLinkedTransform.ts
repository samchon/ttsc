import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";

/**
 * Reports whether the given transform source is linked into another compiler
 * host instead of owning the process itself.
 *
 * @evidence contracts/common.md#principled-implementation Both transform stage and linked ownership must hold; a check-stage descriptor never becomes a transform library merely by sharing the kind spelling.
 * @evidence contracts/common.md#clear-and-simple-design One discriminant predicate supplies filtering and host selection, so each consumer uses the same ownership distinction.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Declared stage and kind decide ownership, independent of plugin names, binary filenames or expected consumer outcomes.
 * @evidence contracts/common.md#meaningful-documentation The native sentence identifies the ownership distinction without reciting the equality expressions, following the documentation skill.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Stage and kind are platform-independent descriptor values; this predicate owns no native path or process boundary.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Two literal discriminant comparisons choose no growing-workload algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The predicate reads a supplied descriptor and coordinates no cross-request work.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No state, handle or task is acquired or retained by this predicate.
 */
export function isLinkedTransform(plugin: ITtscLoadedNativePlugin): boolean {
  return plugin.stage === "transform" && plugin.kind === "linked";
}
