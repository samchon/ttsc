import type {
  Expression,
  TaggedTemplateExpression,
  TemplateLiteral,
  TypeNode,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TaggedTemplateExpression}: a template literal invoked by a tag
 * function.
 *
 * `tag` is the function applied to the template, `typeArguments` are its
 * optional generic arguments, and `template` is the template literal itself.
 * The printer writes the tag directly against the template with no space
 * between them.
 *
 * With `tag` of `tag` and a template of ``hi``, the printer emits:
 *
 * ```ts
 * tag`hi`;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tag The tag expression applied to the template.
 * @param typeArguments The generic type arguments, if any.
 * @param template The template literal.
 * @returns The created {@link TaggedTemplateExpression}.
 */
export const createTaggedTemplateExpression = (
  tag: Expression,
  typeArguments: readonly TypeNode[] | undefined,
  template: TemplateLiteral,
): TaggedTemplateExpression =>
  make("TaggedTemplateExpression", { tag, typeArguments, template });
