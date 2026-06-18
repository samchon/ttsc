import type { Identifier } from "../names/Identifier";
import type { ExpressionWithTypeArguments } from "../types/ExpressionWithTypeArguments";
import type { JSDocComment } from "./JSDocComment";

/**
 * An `@augments` (synonym `@extends`) JSDoc tag.
 *
 * Built by {@link factory.createJSDocAugmentsTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
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
