import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@type` JSDoc tag.
 *
 * Built by {@link factory.createJSDocTypeTag}.
 *
 * The required type expression includes its braces when printed. This records
 * an annotation and does not infer or validate the documented value's type.
 *
 * @evidence contracts/common.md#principled-implementation A required JSDocTypeExpression supplies the braced annotation payload and distinguishes it from free comment text without asserting that a documented value matches the type.
 * @evidence contracts/common.md#clear-and-simple-design Brace syntax stays in the reusable type wrapper; the tag stores its name and optional description without inference state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The type is an explicit caller node rather than an inferred fixture answer or a patched declaration type.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes brace ownership and the absence of inference or validation; separate paragraphs and member comments follow the documentation guidance.
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
