import type { Expression, ParenthesizedExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ParenthesizedExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link ParenthesizedExpression}.
 */
export const createParenthesizedExpression = (
  expression: Expression,
): ParenthesizedExpression => make("ParenthesizedExpression", { expression });
