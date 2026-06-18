import type {
  TemplateHead,
  TemplateLiteralTypeNode,
  TemplateLiteralTypeSpan,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateLiteralTypeNode}: a ``id-${string}`` template literal
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
 * `id-${string}`;
 * ```
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
