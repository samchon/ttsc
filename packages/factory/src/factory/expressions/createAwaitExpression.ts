import type { AwaitExpression, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link AwaitExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link AwaitExpression}.
 */
export const createAwaitExpression = (
  expression: Expression,
): AwaitExpression => make("AwaitExpression", { expression });
