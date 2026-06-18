import type { TemplateExpression, TemplateHead, TemplateSpan } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateExpression}: a template literal with one or more
 * interpolations.
 *
 * `head` is the leading text up to the first `${`, and each entry in
 * `templateSpans` pairs an interpolated expression with the literal text that
 * follows it. The printer wraps the whole thing in backticks and renders each
 * span as `${expression}` followed by its trailing text.
 *
 * With `head` of `a`, a span interpolating `x` and a tail of `b`, the printer
 * emits:
 *
 * ```ts
 * `a${x}b`;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param head The leading literal text before the first interpolation.
 * @param templateSpans The interpolation spans.
 * @returns The created {@link TemplateExpression}.
 */
export const createTemplateExpression = (
  head: TemplateHead,
  templateSpans: readonly TemplateSpan[],
): TemplateExpression => make("TemplateExpression", { head, templateSpans });
