import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * A `@deprecated` JSDoc tag.
 *
 * Built by {@link factory.createJSDocDeprecatedTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocDeprecatedTag {
  /** Discriminant tag; always `"JSDocDeprecatedTag"`. */
  kind: "JSDocDeprecatedTag";

  /** The tag name, e.g. `deprecated`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
