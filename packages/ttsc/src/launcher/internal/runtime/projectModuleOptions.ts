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
