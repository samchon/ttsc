import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@type` JSDoc tag.
 *
 * Built by {@link factory.createJSDocTypeTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocTypeTag {
  /** Discriminant tag; always `"JSDocTypeTag"`. */
  kind: "JSDocTypeTag";

  /** The tag name, e.g. `type`. */
  tagName: Identifier;

  /** The type expression. */
  typeExpression: JSDocTypeExpression;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
