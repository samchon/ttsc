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
