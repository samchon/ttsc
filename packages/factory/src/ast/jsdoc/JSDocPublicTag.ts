import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * A `@public` JSDoc tag.
 *
 * Built by {@link factory.createJSDocPublicTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocPublicTag {
  /** Discriminant tag; always `"JSDocPublicTag"`. */
  kind: "JSDocPublicTag";

  /** The tag name, e.g. `public`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
