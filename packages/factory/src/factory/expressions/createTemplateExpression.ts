import type { TemplateExpression, TemplateHead, TemplateSpan } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param head The head.
 * @param templateSpans The templateSpans.
 * @returns The created node.
 */
export const createTemplateExpression = (
  head: TemplateHead,
  templateSpans: readonly TemplateSpan[],
): TemplateExpression => make("TemplateExpression", { head, templateSpans });
