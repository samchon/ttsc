import type { ParseResult } from "./ParseResult";

/**
 * Return the stored numeric value of a canonical flag name. Absence or a
 * differently typed entry returns `undefined`; this accessor does not parse
 * strings or impose a numeric range.
 *
 * @evidence contracts/common.md#principled-implementation typeof number retrieves exactly a numeric map entry without converting other parser values; numeric validation remains with the flag's parser rather than the accessor.
 * @evidence contracts/common.md#clear-and-simple-design One lookup and narrowing expose the value, with no duplicated validator or fallback policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts String coercion cannot turn a differently typed option into a number, and legitimate zero is returned unchanged.
 * @evidence contracts/common.md#meaningful-documentation The native comment states canonical-name input, undefined behavior and the lack of coercion or range validation, applying the documentation skill's contract-focused prose.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources getNumber declares a signature only; the implementation owns acquisition and release of resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms getNumber declares a signature only; the implementation owns the processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work getNumber declares a signature only; the implementation owns any shared work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation getNumber is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
 */
export function getNumber(
  result: ParseResult,
  flag: string,
): number | undefined {
  const value = result.values.get(flag);
  if (typeof value === "number") return value;
  return undefined;
}
