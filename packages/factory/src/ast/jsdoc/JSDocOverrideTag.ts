import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * An `@override` JSDoc tag.
 *
 * Built by {@link factory.createJSDocOverrideTag}.
 *
 * The marker documents an override but does not establish a corresponding base
 * member. Omitting the description leaves a bare tag.
 *
 * @evidence contracts/common.md#principled-implementation The override-tag kind records the annotation and optional prose without asserting a checked relationship to a base declaration.
 * @evidence contracts/common.md#clear-and-simple-design The node stores the printed marker payload only, leaving member lookup and class hierarchy to semantic consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Override intent is caller-authored documentation rather than a guessed base member or a replacement of foreign methods.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes the unchecked base-member relationship and omitted-description output; member and paragraph separation follows the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocOverrideTag {
  /** Discriminant tag; always `"JSDocOverrideTag"`. */
  kind: "JSDocOverrideTag";

  /** The tag name, e.g. `override`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
