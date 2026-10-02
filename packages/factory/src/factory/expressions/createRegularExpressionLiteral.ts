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
 * /ab+c/i
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Complete source text retains regexp delimiters, pattern and flags for verbatim emission; valid spelling and flag combinations remain caller premises.
 * @evidence contracts/common.md#clear-and-simple-design One make call stores lexical text without parsing it into a redundant runtime RegExp or separate flag schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The source comes from the caller rather than a known fixture matcher or a post-print escape patch.
 * @evidence contracts/common.md#meaningful-documentation Native prose states delimiters, flags and absent validation/escaping; the expression example and tag block are separated under documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The full regex literal source, including delimiters and flags.
 * @returns The created {@link RegularExpressionLiteral}.
 */
export const createRegularExpressionLiteral = (
  text: string,
): RegularExpressionLiteral => make("RegularExpressionLiteral", { text });
