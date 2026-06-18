import type { DeleteExpression, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link DeleteExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created node.
 */
export const createDeleteExpression = (
  expression: Expression,
): DeleteExpression => make("DeleteExpression", { expression });
