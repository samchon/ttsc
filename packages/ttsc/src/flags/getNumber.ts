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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The numeric scalar transfers to the caller without retaining its map or acquiring native resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One existing-map lookup and numeric type guard perform scalar access; lexical numeric parsing and range validation belong to the flag parser.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This accessor coordinates no numeric parser or other producer and retains no computed answer between calls.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A canonical option key and stored JavaScript number carry no native path, executable, environment or OS capability here.
 */
export function getNumber(
  result: ParseResult,
  flag: string,
): number | undefined {
  const value = result.values.get(flag);
  if (typeof value === "number") return value;
  return undefined;
}
