import type {
  Expression,
  TaggedTemplateExpression,
  TemplateLiteral,
  TypeNode,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TaggedTemplateExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tag The tag.
 * @param typeArguments The typeArguments.
 * @param template The template.
 * @returns The created node.
 */
export const createTaggedTemplateExpression = (
  tag: Expression,
  typeArguments: readonly TypeNode[] | undefined,
  template: TemplateLiteral,
): TaggedTemplateExpression =>
  make("TaggedTemplateExpression", { tag, typeArguments, template });
