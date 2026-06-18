import type { Expression, TypeOfExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TypeOfExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link TypeOfExpression}.
 */
export const createTypeOfExpression = (
  expression: Expression,
): TypeOfExpression => make("TypeOfExpression", { expression });
