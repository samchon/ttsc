import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * A `@class` JSDoc tag.
 *
 * Built by {@link factory.createJSDocClassTag}.
 *
 * This marks a documented class without storing its declaration. An omitted
 * description leaves a bare tag; the annotation does not create a class.
 *
 * @evidence contracts/common.md#principled-implementation A tag name and optional prose express a class marker, keeping documentation intent distinct from an executable class declaration.
 * @evidence contracts/common.md#clear-and-simple-design The class marker has no constructor or member payload because those belong to declarations rather than this printed annotation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The marker is explicit documentation data, not a fabricated class or a mutation of a foreign declaration model.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes annotation from declaration and explains absent descriptions; paragraph and member separation follows the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocClassTag {
  /** Discriminant tag; always `"JSDocClassTag"`. */
  kind: "JSDocClassTag";

  /** The tag name, e.g. `class`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
