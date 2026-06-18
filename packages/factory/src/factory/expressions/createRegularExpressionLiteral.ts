import type { RegularExpressionLiteral } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link RegularExpressionLiteral}: a regex literal.
 *
 * `text` is the complete literal source, including the slash delimiters and any
 * trailing flags. The printer emits `text` verbatim; it does not validate or
 * re-escape the pattern.
 *
 * With `text` of `/ab+c/i`, the printer emits:
 *
 * ```ts
 * /ab+c/i;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The full regex literal source, including delimiters and flags.
 * @returns The created {@link RegularExpressionLiteral}.
 */
export const createRegularExpressionLiteral = (
  text: string,
): RegularExpressionLiteral => make("RegularExpressionLiteral", { text });
