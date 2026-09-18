import type { ParseResult } from "./ParseResult";

/**
 * Return every string value accepted for a `repeatable` flag, in argv order.
 *
 * `values` keeps only the last occurrence, which is the wrong answer for a flag
 * whose whole point is repetition (`ttsx -r a -r b` preloads both). Returns an
 * empty array when the flag never appeared.
 */
export function getStringList(result: ParseResult, flag: string): string[] {
  return (result.repeated.get(flag) ?? []).filter(
    (value): value is string => typeof value === "string",
  );
}
