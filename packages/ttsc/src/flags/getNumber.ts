import type { ParseResult } from "./ParseResult";

/** Return the numeric value of `flag` or `undefined` if not present. */
export function getNumber(
  result: ParseResult,
  flag: string,
): number | undefined {
  const value = result.values.get(flag);
  if (typeof value === "number") return value;
  return undefined;
}
