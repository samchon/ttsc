import type { Expression } from "./Expression";

/**
 * A `delete` expression.
 *
 * Built by {@link factory.createDeleteExpression}.
 *
 * The operand describes source syntax; this node deletes no host object.
 * Operand and strict-mode legality must be established by the caller.
 *
 * @evidence contracts/common.md#principled-implementation The expression field preserves the delete operand while the kind selects its keyword; the outline does not establish whether that operand is legal in the enclosing language context.
 * @evidence contracts/common.md#clear-and-simple-design A single operand is sufficient; no property lookup result or runtime deletion state enters the syntax shape.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Delete syntax does not mutate a foreign object or replace deletion with a fixture-specific result.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the absence of host mutation and caller-owned legality; the operand and tags use separate documentation blocks.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface DeleteExpression {
  /** Discriminant tag; always `"DeleteExpression"`. */
  kind: "DeleteExpression";

  /** Operand printed after `delete`; its legality is not validated here. */
  expression: Expression;
}
