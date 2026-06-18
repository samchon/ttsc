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
 * delete obj.prop;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression to delete.
 * @returns The created {@link DeleteExpression}.
 */
export const createDeleteExpression = (
  expression: Expression,
): DeleteExpression => make("DeleteExpression", { expression });
