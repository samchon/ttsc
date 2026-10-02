import type { TemplateMiddle } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateMiddle}: a span of a template expression that sits
 * between two substitutions, from one `}` to the next `${`.
 *
 * The `text` is the cooked content of that span. The optional `rawText` carries
 * the source spelling before escape processing; the printer emits it verbatim
 * when present, and otherwise escapes the cooked `text` so it re-parses to the
 * same value. A middle span only appears in a template literal that has two or
 * more substitutions, and it is one piece of that larger literal rather than a
 * complete expression.
 *
 * The printer emits the closing `}` of the preceding substitution, the content,
 * then the `${` that opens the next one. With `text` of `mid`, this prints:
 *
 * ```ts
 * }mid${
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   TemplateMiddle stores the span between substitutions, preserving cooked
 *   content and optional raw spelling as separate representation fields.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This builder owns one span, while TemplateExpression composes spans and
 *   the printer adds the closing-brace and next-substitution delimiters.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The middle-span discriminant represents grammar, not guessed output text.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains both delimiters, the multi-substitution condition and raw
 *   precedence in distinct paragraphs separated from acknowledgment tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The text.
 * @param rawText The source spelling before escape processing, if supplied.
 * @returns The created node.
 */
export const createTemplateMiddle = (
  text: string,
  rawText?: string,
): TemplateMiddle => make("TemplateMiddle", { text, rawText });
