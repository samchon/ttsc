import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@this` JSDoc tag.
 *
 * Built by {@link factory.createJSDocThisTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocThisTag {
  /** Discriminant tag; always `"JSDocThisTag"`. */
  kind: "JSDocThisTag";

  /** The tag name, e.g. `this`. */
  tagName: Identifier;

  /** The type expression. */
  typeExpression: JSDocTypeExpression;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
