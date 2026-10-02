import type { Expression } from "../expressions/Expression";

/**
 * An expression used as a statement, e.g. `foo();`.
 *
 * Built by {@link factory.createExpressionStatement}.
 *
 * @evidence contracts/common.md#principled-implementation The wrapper records statement placement for an Expression so printing can apply statement grouping; broad expression validity remains unchecked.
 * @evidence contracts/common.md#clear-and-simple-design One payload delegates expression structure without mixing it with surrounding statements.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied expressions are syntax data, without consumer-specific executable behavior.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates a call statement and describes its expression payload; member spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ExpressionStatement {
  /** Discriminant tag; always `"ExpressionStatement"`. */
  kind: "ExpressionStatement";

  /** The expression. */
  expression: Expression;
}
