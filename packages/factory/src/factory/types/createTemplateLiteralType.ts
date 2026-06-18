import type {
  TemplateHead,
  TemplateLiteralTypeNode,
  TemplateLiteralTypeSpan,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateLiteralType}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param head The head.
 * @param templateSpans The templateSpans.
 * @returns The created node.
 */
export const createTemplateLiteralType = (
  head: TemplateHead,
  templateSpans: readonly TemplateLiteralTypeSpan[],
): TemplateLiteralTypeNode =>
  make("TemplateLiteralType", { head, templateSpans });
