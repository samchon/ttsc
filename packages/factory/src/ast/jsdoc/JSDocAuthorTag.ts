import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * An `@author` JSDoc tag.
 *
 * Built by {@link factory.createJSDocAuthorTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocAuthorTag {
  /** Discriminant tag; always `"JSDocAuthorTag"`. */
  kind: "JSDocAuthorTag";

  /** The tag name, e.g. `author`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
