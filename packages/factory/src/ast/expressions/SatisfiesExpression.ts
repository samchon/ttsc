import type { TypeNode } from "../types/TypeNode";
import type { Expression } from "./Expression";

/**
 * A `satisfies` expression, e.g. `value satisfies T`.
 *
 * Built by {@link factory.createSatisfiesExpression}.
 *
 * This records the check in source syntax; constructing or printing the node
 * does not perform assignability checking or convert the operand's value.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Operand and target TypeNode preserve the two sides of satisfies syntax; the outline records a requested type check without establishing its success.
 * @evidence contracts/common.md#clear-and-simple-design Two direct constituents suffice, with checking and precedence handled by their actual compiler and printer owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The explicit type check is not replaced by a forced assertion, patched operand or fabricated success result.
 * @evidence contracts/common.md#meaningful-documentation Native prose separates syntax construction from assignability checking and conversion; member comments and tags follow documentation spacing guidance.
 */
export interface SatisfiesExpression {
  /** Discriminant tag; always `"SatisfiesExpression"`. */
  kind: "SatisfiesExpression";

  /** The expression. */
  expression: Expression;

  /** The type. */
  type: TypeNode;
}
