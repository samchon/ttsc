import type {
  Expression,
  TemplateMiddle,
  TemplateSpan,
  TemplateTail,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateSpan}: one interpolation segment of a template
 * literal.
 *
 * A span pairs `expression`, the interpolated value, with `literal`, the static
 * text that follows it. `literal` is a {@link TemplateMiddle} when more spans
 * follow or a {@link TemplateTail} for the last one. Spans are not standalone
 * expressions; they live inside a {@link TemplateExpression}, which supplies the
 * leading head and the surrounding backticks.
 *
 * With `expression` of `x` and a tail literal of `b`, the printer emits the
 * fragment:
 *
 * ```ts
 * x}b`
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The interpolated expression.
 * @param literal The static text following the interpolation.
 * @returns The created {@link TemplateSpan}.
 * @evidence contracts/common.md#principled-implementation One substitution expression followed by a middle-or-tail chunk preserves template alternation; the enclosing template determines whether this continuation or terminal chunk is in a valid position.
 * @evidence contracts/common.md#clear-and-simple-design The two constituents form a reusable span without duplicating the preceding head or its opening delimiter.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The expression is retained instead of a precomputed interpolation value spliced into literal text.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains middle/tail placement and why the fragment is incomplete, with the fragment example and parameters separated from tags.
 */
export const createTemplateSpan = (
  expression: Expression,
  literal: TemplateMiddle | TemplateTail,
): TemplateSpan => make("TemplateSpan", { expression, literal });
