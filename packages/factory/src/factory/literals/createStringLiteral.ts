import type { StringLiteral } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link StringLiteral}: a quoted string literal expression.
 *
 * The `text` is the raw, unescaped content of the string. By default the
 * printer wraps it in double quotes; pass `isSingleQuote` as `true` to wrap it
 * in single quotes instead.
 *
 * In a JavaScript expression, the printer escapes the active quote character
 * with a backslash: `\"` inside double quotes or `\'` inside single quotes. The
 * other quote character is left untouched. In a quoted JSX attribute, entities
 * preserve the cooked value instead; backslashes stay literal.
 *
 * With `text` of `he said "hi"` and the default quoting, this prints:
 *
 * ```ts
 * "he said \"hi\"";
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The textual content.
 * @param isSingleQuote When `true`, use single quotes instead of double.
 * @returns The created {@link StringLiteral}.
 * @evidence contracts/common.md#principled-implementation
 *   StringLiteral keeps unescaped text and quote preference separately so the
 *   printer can escape the chosen delimiter without altering content here.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This builder maps isSingleQuote to the outline's singleQuote field;
 *   escaping belongs to printing and does not create a second encoding layer.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Quote preference is an explicit caller argument rather than patched output.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains unescaped input, quote selection and active-delimiter
 *   escaping in separate paragraphs with an example and a blank before tags.
 */
export const createStringLiteral = (
  text: string,
  isSingleQuote?: boolean,
): StringLiteral => make("StringLiteral", { text, singleQuote: isSingleQuote });
