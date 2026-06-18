import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocNameReference } from "./JSDocNameReference";

/**
 * A `@see` JSDoc tag.
 *
 * Built by {@link factory.createJSDocSeeTag}.
 *
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
