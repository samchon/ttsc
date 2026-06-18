import type { TemplateMiddle } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateMiddle}: a span of a template expression that sits
 * between two substitutions, from one `}` to the next `${`.
 *
 * The `text` is the cooked content of that span. A middle span only appears in
 * a template literal that has two or more substitutions, and it is one piece of
 * that larger literal rather than a complete expression.
 *
 * The printer emits the closing `}` of the preceding substitution, the content,
 * then the `${` that opens the next one. With `text` of `mid`, this prints:
 *
 * ```ts
 * }mid${
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The text.
 * @returns The created node.
 */
export const createTemplateMiddle = (text: string): TemplateMiddle =>
  make("TemplateMiddle", { text });
