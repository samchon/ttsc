import type { ParseResult } from "./ParseResult";

/**
 * Return the boolean value of `flag`, or `undefined` if not present.
 *
 * One of the typed accessors over {@link ParseResult}: the parser stores raw
 * values (`string | boolean | number`) so the engine stays untyped, and each
 * caller picks the shape per flag.
 */
export function getBoolean(
  result: ParseResult,
  flag: string,
): boolean | undefined {
  const value = result.values.get(flag);
  if (typeof value === "boolean") return value;
  return undefined;
}
