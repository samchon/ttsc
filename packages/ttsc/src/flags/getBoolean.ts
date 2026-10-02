import type { ParseResult } from "./ParseResult";

/**
 * Return a canonical flag's stored boolean value. Absence or a differently
 * typed entry returns `undefined`; `false` remains a present value.
 *
 * One of the typed accessors over {@link ParseResult}: the parser stores raw
 * values (`string | boolean | number`) so the engine stays untyped, and each
 * caller picks the shape per flag.
 *
 * @evidence contracts/common.md#principled-implementation A typeof boolean guard narrows the canonical map entry without coercion; absence and a differently typed value both return undefined, while false remains a present value.
 * @evidence contracts/common.md#clear-and-simple-design The accessor performs only the requested runtime narrowing, leaving flag identity and parsing policy with their existing owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No truthiness conversion substitutes for the stored value, so a false flag cannot silently become missing or true.
 * @evidence contracts/common.md#meaningful-documentation The comment explains the typed accessor's place over ParseResult and its absent result, using a separate context paragraph as the documentation skill requires.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This lookup returns a scalar without retaining the caller's map or acquiring a handle, task or historical state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One existing-map lookup and a typeof guard perform scalar access; map storage and parsing algorithms remain with their owners.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Scalar access coordinates no completed or in-flight producer work and keeps no cached result.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The canonical flag token is a map key, not a native path; inspecting its stored value uses no filesystem, process or platform capability.
 */
export function getBoolean(
  result: ParseResult,
  flag: string,
): boolean | undefined {
  const value = result.values.get(flag);
  if (typeof value === "boolean") return value;
  return undefined;
}
