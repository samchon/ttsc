import type {
  TemplateHead,
  TemplateLiteralTypeNode,
  TemplateLiteralTypeSpan,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateLiteralTypeNode}: a `id-${string}` template literal
 * type.
 *
 * The head supplies the leading text up to the first `${`, then each span
 * contributes an interpolated type followed by the literal text up to the next
 * `${` or the closing backtick. The spans print back to back, so the whole
 * thing reads as one template string.
 *
 * Given the head text `id-` and a single span of `string` ending the template,
 * the printer renders:
 *
 * ```ts
 * `id-${string}`
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The head and ordered type spans preserve template boundaries; each span
 *   carries its interpolated type and following literal instead of a value expression.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The parent composes existing head/span nodes and leaves escaping to literal
 *   emission, without enumerating the strings denoted by the template type.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Literal prefixes do not select fabricated string unions or fixture-specific
 *   output; all supplied spans remain in their original order.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains head/span boundary ownership and illustrates the complete
 *   type without a statement terminator; both child inputs are documented.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param head The leading text up to the first interpolation.
 * @param templateSpans The interpolated spans.
 * @returns The created {@link TemplateLiteralTypeNode}.
 */
export const createTemplateLiteralType = (
  head: TemplateHead,
  templateSpans: readonly TemplateLiteralTypeSpan[],
): TemplateLiteralTypeNode =>
  make("TemplateLiteralType", { head, templateSpans });
