import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * A `@protected` JSDoc tag.
 *
 * Built by {@link factory.createJSDocProtectedTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocProtectedTag {
  /** Discriminant tag; always `"JSDocProtectedTag"`. */
  kind: "JSDocProtectedTag";

  /** The tag name, e.g. `protected`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
