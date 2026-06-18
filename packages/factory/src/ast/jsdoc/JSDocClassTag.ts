import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * A `@class` JSDoc tag.
 *
 * Built by {@link factory.createJSDocClassTag}.
 *
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
