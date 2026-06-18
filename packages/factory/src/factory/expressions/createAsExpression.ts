import type { AsExpression, Expression, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link AsExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param type The type.
 * @returns The created {@link AsExpression}.
 */
export const createAsExpression = (
  expression: Expression,
  type: TypeNode,
): AsExpression => make("AsExpression", { expression, type });
