import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocNameReference } from "./JSDocNameReference";

/**
 * A `@see` JSDoc tag.
 *
 * Built by {@link factory.createJSDocSeeTag}.
 *
 * An absent name leaves a description-only tag. A supplied name is printed
 * before the description but is not resolved against documented declarations.
 *
 * @evidence contracts/common.md#principled-implementation An optional structured reference and optional description admit both named and prose-only see annotations without asserting that a target declaration exists.
 * @evidence contracts/common.md#clear-and-simple-design The reusable name-reference wrapper owns target syntax while this tag combines it with spelling and description, with no lookup table or duplicate target text.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts References remain explicit caller data rather than guessed documentation destinations or consumer-specific resolution fallbacks.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the description-only case and unresolved-target behavior; optional members and paragraphs are separated according to the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocSeeTag {
  /** Discriminant tag; always `"JSDocSeeTag"`. */
  kind: "JSDocSeeTag";

  /** The tag name, e.g. `see`. */
  tagName: Identifier;

  /** The referenced name, if any. */
  name?: JSDocNameReference;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
