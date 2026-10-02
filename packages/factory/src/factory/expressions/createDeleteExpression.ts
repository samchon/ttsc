import type { DeleteExpression, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link DeleteExpression}: a `delete` of an operand.
 *
 * The printer writes the `delete` keyword followed by a single space and the
 * operand expression.
 *
 * Given operand `obj.prop`, the printer emits:
 *
 * ```ts
 * delete obj.prop
 * ```
 *
 * Callers establish legal delete operands and enclosing strict-mode context.
 * Creating the node does not delete a host object's property.
 *
 * @evidence contracts/common.md#principled-implementation The delete kind and retained operand express deletion syntax without performing deletion or validating enclosing-context legality.
 * @evidence contracts/common.md#clear-and-simple-design One operand feeds shared construction; keyword emission and operand grouping remain printer-owned.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Construction performs no foreign-object deletion or expected-result substitution for a known property.
 * @evidence contracts/common.md#meaningful-documentation Native prose states operand/context validity and no host mutation; its expression example and acknowledgment block are separate.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression to delete.
 * @returns The created {@link DeleteExpression}.
 */
export const createDeleteExpression = (
  expression: Expression,
): DeleteExpression => make("DeleteExpression", { expression });
