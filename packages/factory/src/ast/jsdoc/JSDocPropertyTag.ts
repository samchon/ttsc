import type { EntityName } from "../names/EntityName";
import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@property` (alias `@prop`) JSDoc tag.
 *
 * Built by {@link factory.createJSDocPropertyTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocPropertyTag {
  /** Discriminant tag; always `"JSDocPropertyTag"`. */
  kind: "JSDocPropertyTag";

  /** The tag name, e.g. `prop`. */
  tagName: Identifier;

  /** The property name. */
  name: EntityName;

  /** Whether the name was wrapped in brackets (optional property). */
  isBracketed: boolean;

  /** The type expression, if any. */
  typeExpression?: JSDocTypeExpression;

  /** Whether the name was written before the type. */
  isNameFirst: boolean;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
