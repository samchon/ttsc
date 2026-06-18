import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * An `@enum` JSDoc tag.
 *
 * Built by {@link factory.createJSDocEnumTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocEnumTag {
  /** Discriminant tag; always `"JSDocEnumTag"`. */
  kind: "JSDocEnumTag";

  /** The tag name, e.g. `enum`. */
  tagName: Identifier;

  /** The type expression. */
  typeExpression: JSDocTypeExpression;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
