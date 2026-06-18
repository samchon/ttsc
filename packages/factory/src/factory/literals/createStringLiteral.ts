import type { StringLiteral } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link StringLiteral}: a quoted string literal expression.
 *
 * The `text` is the raw, unescaped content of the string. By default the
 * printer wraps it in double quotes; pass `isSingleQuote` as `true` to wrap it
 * in single quotes instead.
 *
 * The printer escapes the active quote character inside the content. With
 * double quotes, an embedded `"` is emitted as `\"`; with single quotes, an
 * embedded `'` is emitted as `\'`. The other quote character is left
 * untouched.
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
 */
export const createStringLiteral = (
  text: string,
  isSingleQuote?: boolean,
): StringLiteral => make("StringLiteral", { text, singleQuote: isSingleQuote });
