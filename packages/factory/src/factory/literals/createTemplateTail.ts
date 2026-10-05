import type { TemplateTail } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateTail}: the closing span of a template expression, from
 * the last `}` to the trailing backtick.
 *
 * The `text` is the cooked content of that span. The optional `rawText` carries
 * the source spelling before escape processing; the printer emits it verbatim
 * when present, and otherwise escapes the cooked `text` so it re-parses to the
 * same value. A tail closes a template literal that has at least one
 * substitution, and it is one piece of that larger literal rather than a
 * complete expression.
 *
 * The printer emits the closing `}` of the final substitution, the content,
 * then the trailing backtick. With `text` of `tail`, this prints:
 *
 * ```ts
 * }tail`
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The text.
 * @param rawText The source spelling before escape processing, if supplied.
 * @returns The created node.
 * @evidence contracts/common.md#principled-implementation
 *   TemplateTail carries the final span after a substitution. Its cooked text
 *   and optional raw spelling preserve the printer's representation choice.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The builder constructs only the terminal span; template composition and
 *   the final backtick remain the owning expression/printer's responsibilities.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Tail placement follows the supplied AST rather than a patched literal.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native documentation states the last-substitution boundary and raw/cooked
 *   behavior with separated explanatory paragraphs, example and tags.
 */
export const createTemplateTail = (
  text: string,
  rawText?: string,
): TemplateTail => make("TemplateTail", { text, rawText });
