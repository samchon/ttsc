import type { Expression, NonNullExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NonNullExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link NonNullExpression}.
 */
export const createNonNullExpression = (
  expression: Expression,
): NonNullExpression => make("NonNullExpression", { expression });
