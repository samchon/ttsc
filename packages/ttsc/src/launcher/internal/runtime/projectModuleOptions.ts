import type { OwningModuleOptions } from "./OwningModuleOptions";

/**
 * Copy the declared string module and target from resolved compiler options.
 * Missing or non-string values stay absent so format selection applies its own
 * compiler defaults.
 *
 * @evidence contracts/common.md#principled-implementation String-only projection preserves declared values and absence for the two inputs that determine emit format; unrelated or invalid option values do not masquerade as a format declaration.
 * @evidence contracts/common.md#clear-and-simple-design One small projection keeps build metadata independent of the full compiler-options object and leaves format policy with RuntimeModuleFormat.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer-specific default or guessed module mode substitutes for the resolved owning-project options.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains rejected value shapes and why absence is retained rather than repeating the two member names.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The projection returns a caller-owned two-field value and retains no configuration history, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms This fixed two-property string-shape projection chooses no traversal, index or processing strategy; format policy remains with RuntimeModuleFormat.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The projection owns no cross-request computation coordinator or configuration invalidation cache.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Module and target strings are compiler-format options, not native path, process identity or capability representations; native file/package classification belongs to the format consumer.
 */
export function projectModuleOptions(
  compilerOptions: Record<string, unknown>,
): OwningModuleOptions {
  return {
    ...(typeof compilerOptions.module === "string"
      ? { module: compilerOptions.module }
      : {}),
    ...(typeof compilerOptions.target === "string"
      ? { target: compilerOptions.target }
      : {}),
  };
}
