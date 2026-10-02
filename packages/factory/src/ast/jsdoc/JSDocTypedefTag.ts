import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";
import type { JSDocTypeLiteral } from "./JSDocTypeLiteral";

/**
 * A `@typedef` JSDoc tag.
 *
 * Built by {@link factory.createJSDocTypedefTag}.
 *
 * The aliased payload may be a braced type or a collection of property tags,
 * which print as `{Object}` or `{Object[]}` followed by one line per property.
 * Omitting it leaves the optional alias name and description. This annotation
 * does not bind an alias in a compiler symbol table.
 *
 * @evidence contracts/common.md#principled-implementation The union distinguishes a braced type from a JSDoc property-tag shape, and optional payload and name retain printable typedef forms without claiming alias binding or semantic validity of every combination.
 * @evidence contracts/common.md#clear-and-simple-design Existing type-expression and type-literal nodes own their payloads; this tag adds only the optional alias name and description instead of another type model.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alias syntax is explicit annotation data rather than a hardcoded resolved type, special fixture alias or mutation of a foreign symbol table.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the two payload forms, omitted-payload output and lack of alias binding; separate paragraphs and documented fields follow the documentation guidance.
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
