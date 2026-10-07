import type { Expression } from "./Expression";

/**
 * A spread member of an object literal, e.g. `{ ...rest }`.
 *
 * Built by {@link factory.createSpreadAssignment}.
 *
 * The expression is the spread source in an object value, or the rest target in
 * an object assignment pattern. Callers ensure the enclosing form and target
 * restrictions are valid.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation One expression plus the spread-member kind preserves object spread or assignment-rest syntax; operand legality depends on the enclosing value or target context.
 * @evidence contracts/common.md#clear-and-simple-design The member records a single source or target, while the enclosing object owns position and punctuation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Spread stays structural rather than copying a known source's properties into hardcoded assignments.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes both context-dependent roles and caller validity; the member and acknowledgment block follow documentation separation guidance.
 */
export interface SpreadAssignment {
  /** Discriminant tag; always `"SpreadAssignment"`. */
  kind: "SpreadAssignment";

  /** The expression. */
  expression: Expression;
}
