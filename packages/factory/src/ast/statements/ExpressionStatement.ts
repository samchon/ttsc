import type { Expression } from "../expressions/Expression";

/**
 * An expression used as a statement, e.g. `foo();`.
 *
 * Built by {@link factory.createExpressionStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The wrapper records statement placement for an Expression so printing can apply statement grouping; broad expression validity remains unchecked.
 * @evidence contracts/common.md#clear-and-simple-design One payload delegates expression structure without mixing it with surrounding statements.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied expressions are syntax data, without consumer-specific executable behavior.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates a call statement and describes its expression payload; member spacing follows the documentation skill.
 */
export interface ExpressionStatement {
  /** Discriminant tag; always `"ExpressionStatement"`. */
  kind: "ExpressionStatement";

  /** The expression. */
  expression: Expression;
}
