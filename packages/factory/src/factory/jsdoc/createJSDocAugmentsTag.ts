import type {
  ExpressionWithTypeArguments,
  Identifier,
  JSDocAugmentsTag,
  JSDocComment,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocAugmentsTag}: an `@augments` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `augments` when omitted. The
 * `className` is the base class expression, which the printer wraps in braces.
 * The `comment` is the trailing description, if any.
 *
 * With the default tag name and a `Base` class expression, the printer emits:
 *
 * ```ts
 * @augments {Base}
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `augments`.
 * @param className The augmented class.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocAugmentsTag}.
 * @evidence contracts/common.md#principled-implementation The className argument maps directly to the class payload, and an absent name receives augments while supplied aliases remain intact; construction does not resolve inheritance.
 * @evidence contracts/common.md#clear-and-simple-design One operand mapping and one name default expose the tag's structure, reusing the existing class-expression node for generic arguments.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Augments is the documented default and aliases are caller data rather than consumer-specific inheritance guesses or foreign hierarchy mutation.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the default, class mapping, braces and optional description with an example; separate paragraphs and parameter tags follow the documentation guidance.
 */
export const createJSDocAugmentsTag = (
  tagName: Identifier | undefined,
  className: ExpressionWithTypeArguments,
  comment?: string | readonly JSDocComment[],
): JSDocAugmentsTag =>
  make("JSDocAugmentsTag", {
    tagName: tagName ?? createIdentifier("augments"),
    class: className,
    comment,
  });
