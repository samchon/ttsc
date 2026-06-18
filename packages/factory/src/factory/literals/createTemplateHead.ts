import type { TemplateHead } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateHead}: the opening span of a template expression, from
 * the leading backtick up to the first `${`.
 *
 * The `text` is the cooked content of that span. The optional `rawText` carries
 * the source spelling before escape processing; when omitted, the cooked text
 * is used. A head is not a complete expression on its own, it is one piece of a
 * larger template literal.
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
 * @param rawText The rawText.
 * @returns The created node.
 */
export const createTemplateHead = (
  text: string,
  rawText?: string,
): TemplateHead => make("TemplateHead", { text, rawText });
