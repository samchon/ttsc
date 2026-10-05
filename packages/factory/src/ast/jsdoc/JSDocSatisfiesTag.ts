import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@satisfies` JSDoc tag.
 *
 * Built by {@link factory.createJSDocSatisfiesTag}.
 *
 * The braced type is the documented satisfaction target. The node does not
 * perform an assignability check or add an executable satisfies expression.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A required braced target preserves satisfies-annotation syntax while leaving assignability checking and executable expression semantics outside this record.
 * @evidence contracts/common.md#clear-and-simple-design The reusable type wrapper owns the target representation, with no extra assignability result or duplicate expression model.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Satisfaction is recorded as caller-authored syntax rather than a fabricated successful check or alteration of a foreign checker.
 * @evidence contracts/common.md#meaningful-documentation Native prose names the target and explicitly distinguishes annotation from checking and executable syntax, with paragraph and field separation under the documentation guidance.
 */
export interface JSDocSatisfiesTag {
  /** Discriminant tag; always `"JSDocSatisfiesTag"`. */
  kind: "JSDocSatisfiesTag";

  /** The tag name, e.g. `satisfies`. */
  tagName: Identifier;

  /** The type expression. */
  typeExpression: JSDocTypeExpression;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
