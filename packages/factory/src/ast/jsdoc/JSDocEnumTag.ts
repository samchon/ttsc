import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * An `@enum` JSDoc tag.
 *
 * Built by {@link factory.createJSDocEnumTag}.
 *
 * The required braced type describes enum members. The annotation does not
 * enumerate values or create an executable enum declaration.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A required JSDocTypeExpression represents the enum annotation's member type, keeping that type distinct from an enum value set or declaration.
 * @evidence contracts/common.md#clear-and-simple-design The tag reuses the brace wrapper for its type payload and retains only spelling and optional description beside it.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Enum documentation carries a caller-supplied type rather than fabricated member values or a fixture-specific enum shape.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the member-type role and declaration boundary, with separated paragraphs and documented fields following the documentation guidance.
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
