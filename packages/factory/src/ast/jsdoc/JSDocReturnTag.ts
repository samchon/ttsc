import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@return` / `@returns` JSDoc tag.
 *
 * Built by {@link factory.createJSDocReturnTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocReturnTag {
  /** Discriminant tag; always `"JSDocReturnTag"`. */
  kind: "JSDocReturnTag";

  /** The tag name, e.g. `returns`. */
  tagName: Identifier;

  /** The type expression, if any. */
  typeExpression?: JSDocTypeExpression;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
