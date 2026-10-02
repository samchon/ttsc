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
 * @evidence contracts/common.md#principled-implementation Operand and target TypeNode preserve the two sides of satisfies syntax; the outline records a requested type check without establishing its success.
 * @evidence contracts/common.md#clear-and-simple-design Two direct constituents suffice, with checking and precedence handled by their actual compiler and printer owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The explicit type check is not replaced by a forced assertion, patched operand or fabricated success result.
 * @evidence contracts/common.md#meaningful-documentation Native prose separates syntax construction from assignability checking and conversion; member comments and tags follow documentation spacing guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface SatisfiesExpression {
  /** Discriminant tag; always `"SatisfiesExpression"`. */
  kind: "SatisfiesExpression";

  /** The expression. */
  expression: Expression;

  /** The type. */
  type: TypeNode;
}
