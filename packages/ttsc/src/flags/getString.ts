import type { ParseResult } from "./ParseResult";

/** Return the string value of `flag` or `undefined` if not present. */
export function getString(
  result: ParseResult,
  flag: string,
): string | undefined {
  const value = result.values.get(flag);
  if (typeof value === "string") return value;
  return undefined;
}
