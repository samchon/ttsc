import type { ParseResult } from "./ParseResult";

/**
 * Return the stored string value of a canonical flag name. Absence or a
 * differently typed entry returns `undefined`; an empty string remains a
 * present value.
 *
 * @evidence contracts/common.md#principled-implementation The typeof string guard preserves string values, including the empty string, and distinguishes them from missing or numeric/boolean entries without coercion.
 * @evidence contracts/common.md#clear-and-simple-design This accessor isolates one runtime narrowing while ParseResult and parseFlags retain storage and parsing responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts It returns the stored string directly instead of fabricating a default or stringifying another option type.
 * @evidence contracts/common.md#meaningful-documentation The native comment makes absence and empty-string meaning explicit, following the documentation skill's useful optional-state guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources getString declares a signature only; the implementation owns acquisition and release of resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms getString declares a signature only; the implementation owns the processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work getString declares a signature only; the implementation owns any shared work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation getString is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
 */
export function getString(
  result: ParseResult,
  flag: string,
): string | undefined {
  const value = result.values.get(flag);
  if (typeof value === "string") return value;
  return undefined;
}
