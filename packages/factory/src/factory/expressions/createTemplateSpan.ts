import type {
  Expression,
  TemplateMiddle,
  TemplateSpan,
  TemplateTail,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateSpan}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param literal The literal.
 * @returns The created node.
 */
export const createTemplateSpan = (
  expression: Expression,
  literal: TemplateMiddle | TemplateTail,
): TemplateSpan => make("TemplateSpan", { expression, literal });
