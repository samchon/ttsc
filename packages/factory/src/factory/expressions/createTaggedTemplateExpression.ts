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
 * With `tag` of `tag` and a template of `hi`, the printer emits:
 *
 * ```ts
 * tag`hi`
 * ```
 *
 * A tag can observe raw template spelling. Supply rawText on literal chunks
 * when that exact spelling must be preserved; construction does not execute
 * the tag or derive missing source spelling from earlier input.
 *
 * @evidence contracts/common.md#principled-implementation Tag, optional generics and complete TemplateLiteral retain tagged syntax without converting it into an ordinary call; exact raw spelling depends on the supplied chunk representations.
 * @evidence contracts/common.md#clear-and-simple-design One make call reuses the complete-template type, leaving chunk escaping and tag-target grouping in the printer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The tag is not invoked to precompute expected output, and rawText is an explicit lexical contract rather than a post-print patch.
 * @evidence contracts/common.md#meaningful-documentation Native prose states generic placement and raw-spelling significance, with example, parameter roles and separate acknowledgment tags.
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
