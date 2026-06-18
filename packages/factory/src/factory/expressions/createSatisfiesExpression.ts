import type { Expression, SatisfiesExpression, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SatisfiesExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param type The type.
 * @returns The created {@link SatisfiesExpression}.
 */
export const createSatisfiesExpression = (
  expression: Expression,
  type: TypeNode,
): SatisfiesExpression => make("SatisfiesExpression", { expression, type });
