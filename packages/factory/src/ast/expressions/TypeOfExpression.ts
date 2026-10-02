import type { Expression } from "./Expression";

/**
 * A `typeof` expression (value space).
 *
 * Built by {@link factory.createTypeOfExpression}.
 *
 * This is value-space `typeof`, distinct from a type query. The operand remains
 * syntax; the node does not compute or store its runtime type string.
 *
 * @evidence contracts/common.md#principled-implementation An Expression operand and value-space kind represent the runtime typeof operator, distinguishing it from a TypeQueryNode without evaluating the operand.
 * @evidence contracts/common.md#clear-and-simple-design One operand is sufficient; no predicted type string or type-query schema is mixed into the value expression.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Runtime type syntax is not replaced with a guessed string based on known input fixtures.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains value versus type space and the unevaluated operand, with separate member and acknowledgment blocks under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypeOfExpression {
  /** Discriminant tag; always `"TypeOfExpression"`. */
  kind: "TypeOfExpression";

  /** The expression. */
  expression: Expression;
}
