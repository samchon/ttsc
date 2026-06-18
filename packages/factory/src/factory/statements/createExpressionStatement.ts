import type { Expression, ExpressionStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ExpressionStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link ExpressionStatement}.
 */
export const createExpressionStatement = (
  expression: Expression,
): ExpressionStatement => make("ExpressionStatement", { expression });
