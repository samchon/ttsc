import type { EntityName } from "../names/EntityName";
import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@param` JSDoc tag.
 *
 * Built by {@link factory.createJSDocParameterTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocParameterTag {
  /** Discriminant tag; always `"JSDocParameterTag"`. */
  kind: "JSDocParameterTag";

  /** The tag name, e.g. `param`. */
  tagName: Identifier;

  /** The parameter name. */
  name: EntityName;

  /** Whether the name was wrapped in brackets (optional parameter). */
  isBracketed: boolean;

  /** The type expression, if any. */
  typeExpression?: JSDocTypeExpression;

  /** Whether the name was written before the type. */
  isNameFirst: boolean;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
