import type { Identifier } from "../names/Identifier";
import type { ExpressionWithTypeArguments } from "../types/ExpressionWithTypeArguments";
import type { JSDocComment } from "./JSDocComment";

/**
 * An `@implements` JSDoc tag.
 *
 * Built by {@link factory.createJSDocImplementsTag}.
 *
 * The target expression, including any type arguments, is printed in braces.
 * This documentation node does not check that an implementation satisfies it.
 *
 * @evidence contracts/common.md#principled-implementation A required ExpressionWithTypeArguments retains the annotated target and generic arguments, while the tag record makes no semantic claim that a declaration implements it.
 * @evidence contracts/common.md#clear-and-simple-design The existing expression type owns target structure; this annotation adds only tag spelling and optional description.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The target is explicit caller syntax rather than an assumed interface match or modification of a foreign implementation checker.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains brace emission and the absence of implementation checking; paragraph and member separation follows the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocImplementsTag {
  /** Discriminant tag; always `"JSDocImplementsTag"`. */
  kind: "JSDocImplementsTag";

  /** The tag name, e.g. `implements`. */
  tagName: Identifier;

  /** The implemented class. */
  class: ExpressionWithTypeArguments;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
