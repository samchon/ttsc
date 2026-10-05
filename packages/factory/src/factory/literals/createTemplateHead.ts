import type { TemplateHead } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateHead}: the opening span of a template expression, from
 * the leading backtick up to the first `${`.
 *
 * The `text` is the cooked content of that span. The optional `rawText` carries
 * the source spelling before escape processing; the printer emits it verbatim
 * when present, and otherwise escapes the cooked `text` so it re-parses to the
 * same value. A head is not a complete expression on its own, it is one piece
 * of a larger template literal.
 *
 * The printer emits the opening backtick, the content, then the `${` that opens
 * the first substitution. With `text` of `head`, this prints:
 *
 * ```ts
 * `head${
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The text.
 * @param rawText The source spelling before escape processing, if supplied.
 * @returns The created node.
 * @evidence contracts/common.md#principled-implementation
 *   TemplateHead carries cooked text and optional raw spelling for the opening
 *   span before the first substitution; it is not a complete expression.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Span construction keeps text representations together; the surrounding
 *   template expression and printer own substitutions and delimiters.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The opening-span kind encodes template grammar rather than a special input.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain span boundaries, raw/cooked precedence and why
 *   the head is incomplete, with an example and a blank before tags.
 */
export const createTemplateHead = (
  text: string,
  rawText?: string,
): TemplateHead => make("TemplateHead", { text, rawText });
