import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";
import type { JSDocTypeLiteral } from "./JSDocTypeLiteral";

/**
 * A `@typedef` JSDoc tag.
 *
 * Built by {@link factory.createJSDocTypedefTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocTypedefTag {
  /** Discriminant tag; always `"JSDocTypedefTag"`. */
  kind: "JSDocTypedefTag";

  /** The tag name, e.g. `typedef`. */
  tagName: Identifier;

  /** The aliased type, if any. */
  typeExpression?: JSDocTypeExpression | JSDocTypeLiteral;

  /** The full alias name, if any. */
  fullName?: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
