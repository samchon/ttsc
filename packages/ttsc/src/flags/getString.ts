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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The stored string is returned without copying its bytes or retaining the result map; native resource lifetime is not owned here.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A map lookup and string type guard select one scalar; flag parsing and any later path or executable selection are separate operations.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Returning an existing scalar does not coordinate a shared producer or preserve a cross-call answer.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This accessor does not interpret the string as a native path or executable; the option consumer owns that meaning and its platform boundary.
 */
export function getString(
  result: ParseResult,
  flag: string,
): string | undefined {
  const value = result.values.get(flag);
  if (typeof value === "string") return value;
  return undefined;
}
