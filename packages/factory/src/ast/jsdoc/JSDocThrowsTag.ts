import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@throws` JSDoc tag.
 *
 * Built by {@link factory.createJSDocThrowsTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocThrowsTag {
  /** Discriminant tag; always `"JSDocThrowsTag"`. */
  kind: "JSDocThrowsTag";

  /** The tag name, e.g. `throws`. */
  tagName: Identifier;

  /** The type expression, if any. */
  typeExpression?: JSDocTypeExpression;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
