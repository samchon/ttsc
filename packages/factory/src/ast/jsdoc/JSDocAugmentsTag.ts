import type { Identifier } from "../names/Identifier";
import type { ExpressionWithTypeArguments } from "../types/ExpressionWithTypeArguments";
import type { JSDocComment } from "./JSDocComment";

/**
 * An `@augments` (synonym `@extends`) JSDoc tag.
 *
 * Built by {@link factory.createJSDocAugmentsTag}.
 *
 * The class expression is printed in braces. The tag name preserves spellings
 * such as `augments` or `extends`; the node does not resolve the base class.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A structured class expression and explicit tag identifier represent inheritance annotation syntax, including aliases, without establishing that the documented declaration extends the target.
 * @evidence contracts/common.md#clear-and-simple-design The base expression owns its type arguments while this tag owns spelling and description, avoiding a duplicate inheritance model.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alias spelling is caller data at the supported tag boundary rather than a consumer-name exception or a patched class hierarchy.
 * @evidence contracts/common.md#meaningful-documentation Native prose states brace output, alias spelling and unresolved inheritance; separated member descriptions and paragraphs follow the documentation guidance.
 */
export interface JSDocAugmentsTag {
  /** Discriminant tag; always `"JSDocAugmentsTag"`. */
  kind: "JSDocAugmentsTag";

  /** The tag name, e.g. `augments`. */
  tagName: Identifier;

  /** The augmented class. */
  class: ExpressionWithTypeArguments;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
