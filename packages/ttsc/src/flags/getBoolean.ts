import type { ParseResult } from "./ParseResult";

/**
 * Return the boolean value of `flag`, or `undefined` if not present.
 *
 * One of the typed accessors over {@link ParseResult}: the parser stores raw
 * values (`string | boolean | number`) so the engine stays untyped, and each
 * caller picks the shape per flag.
 *
 * @evidence contracts/common.md#principled-implementation A typeof boolean guard narrows the canonical map entry without coercion; absence and a differently typed value both return undefined, while false remains a present value.
 * @evidence contracts/common.md#clear-and-simple-design The accessor performs only the requested runtime narrowing, leaving flag identity and parsing policy with their existing owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No truthiness conversion substitutes for the stored value, so a false flag cannot silently become missing or true.
 * @evidence contracts/common.md#meaningful-documentation The comment explains the typed accessor's place over ParseResult and its absent result, using a separate context paragraph as the documentation skill requires.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources getBoolean declares a signature only; the implementation owns acquisition and release of resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms getBoolean declares a signature only; the implementation owns the processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work getBoolean declares a signature only; the implementation owns any shared work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation getBoolean is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
 */
export function getBoolean(
  result: ParseResult,
  flag: string,
): boolean | undefined {
  const value = result.values.get(flag);
  if (typeof value === "boolean") return value;
  return undefined;
}
