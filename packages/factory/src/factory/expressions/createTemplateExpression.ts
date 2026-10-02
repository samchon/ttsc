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
 * `a${x}b`
 * ```
 *
 * Supply at least one span, with TemplateMiddle chunks between substitutions
 * and a TemplateTail on the final span. Construction does not validate that
 * sequence grammar or evaluate substitutions.
 *
 * @evidence contracts/common.md#principled-implementation A head and ordered spans preserve alternating literal/substitution syntax; nonempty spans and final-tail placement remain caller premises not enforced by the sequence type.
 * @evidence contracts/common.md#clear-and-simple-design Shared make composes existing head/span types without flattening expressions or storing extra delimiter tokens.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied substitutions remain AST expressions rather than interpolated expected answers or compensating source-text patches.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains span pairing and sequence validity, with a complete template example separated from parameter and acknowledgment tags.
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
