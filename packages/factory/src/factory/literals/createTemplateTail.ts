import type { TemplateTail } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateTail}: the closing span of a template expression, from
 * the last `}` to the trailing backtick.
 *
 * The `text` is the cooked content of that span. A tail closes a template
 * literal that has at least one substitution, and it is one piece of that
 * larger literal rather than a complete expression.
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
 * @returns The created node.
 */
export const createTemplateTail = (text: string): TemplateTail =>
  make("TemplateTail", { text });
